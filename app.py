from flask import Flask, render_template, request, jsonify
import librosa
import numpy as np
import soundfile as sf
import math
import os
import logging
import subprocess

# Set up logging
logging.basicConfig(level=logging.INFO)

app = Flask(__name__)

# Create a directory for uploads if it doesn't exist
if not os.path.exists("uploads"):
    os.makedirs("uploads")

def get_base_note_and_freq(hz):
    note = librosa.hz_to_note(hz)
    base_freq = librosa.note_to_hz(note)
    return note, base_freq

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/analyze', methods=['POST'])
def analyze():
    logging.info("Received request to /analyze")
    
    if 'audio_data' not in request.files:
        logging.error("No audio_data in request.files")
        return jsonify({"error": "لم يتم العثور على ملف صوتي"}), 400

    audio_file = request.files['audio_data']
    if not audio_file:
        logging.error("Empty audio file received")
        return jsonify({"error": "ملف صوتي فارغ"}), 400
        
    try:
        logging.info("Processing audio file")
        
        # Save the uploaded file temporarily
        temp_path = os.path.join("uploads", "temp_audio.wav")
        audio_file.save(temp_path)

        # Load the audio file using librosa. Many browsers record in webm/opus;
        # saving with .wav extension doesn't change encoding. If librosa/soundfile
        # cannot read the file, try converting it to WAV using ffmpeg and retry.
        converted_path = os.path.join("uploads", "temp_audio_converted.wav")
        try:
            y, sr = librosa.load(temp_path, sr=None, mono=True)
            logging.info(f"Audio loaded. Sample rate: {sr}, Duration: {len(y)/sr:.2f}s")
            # Clean up the temporary file
            os.remove(temp_path)
        except Exception as e:
            logging.warning(f"librosa failed to load uploaded file: {e}. Trying ffmpeg conversion.")
            try:
                # Use ffmpeg to convert to a proper WAV file. Requires ffmpeg installed on the system.
                subprocess.run(["ffmpeg", "-y", "-i", temp_path, converted_path], check=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
                y, sr = librosa.load(converted_path, sr=None, mono=True)
                logging.info(f"Loaded after ffmpeg conversion. Sample rate: {sr}, Duration: {len(y)/sr:.2f}s")
                # cleanup both files
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                if os.path.exists(converted_path):
                    os.remove(converted_path)
            except Exception as e2:
                logging.error(f"FFmpeg conversion or loading failed: {e2}")
                # cleanup
                if os.path.exists(temp_path):
                    os.remove(temp_path)
                if os.path.exists(converted_path):
                    os.remove(converted_path)
                raise Exception(f"خطأ في قراءة الملف الصوتي: {str(e)}; تحويل ffmpeg فشل: {str(e2)}")

        # Pitch detection with more precise parameters
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, 
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            frame_length=2048,
            win_length=1024,
            hop_length=512,
            sr=sr
        )
        
        # Filter out NaN values and low confidence predictions
        f0_voiced = f0[np.isfinite(f0) & voiced_flag & (voiced_probs > 0.6)]
        
        if len(f0_voiced) < 5:
            logging.error("Not enough voiced frames detected")
            return jsonify({"error": "لم يتمكن من تحديد نغمة واضحة. يرجى النفخ بشكل أطول وأكثر ثباتًا."}), 400
            
        f_actual = float(np.median(f0_voiced))
        logging.info(f"Median frequency: {f_actual:.2f} Hz")

        # Find the nearest standard note and its frequency
        note_actual, f_standard = get_base_note_and_freq(f_actual)

        # Calculate deviation in Cents
        if f_actual <= 0 or f_standard <= 0:
            return jsonify({"error": "تردد غير صالح"}), 400
        
        cents = 1200 * math.log2(f_actual / f_standard)
        a4_actual = 440 * (2**(cents / 1200))
        
        # Generate recommendations
        a4_actual_rounded = round(a4_actual, 2)
        ney_at_440_produces = round(440 * (a4_actual / 440), 2)
        ideal_ney_for_440 = round(440 * (440 / a4_actual), 2)

        rec_standard = f"إذا عزفت على ناي قياسي (440 ذ/ث)، ستكون النغمة الناتجة {ney_at_440_produces} ذ/ث. للحصول على نغمة 440 ذ/ث مضبوطة، تحتاج إلى ناي بمقياس {ideal_ney_for_440} ذ/ث."
        rec_custom = f"مقياس نفختك الفعلي هو {a4_actual_rounded} ذ/ث."

        response_data = {
            "f_actual": round(f_actual, 2),
            "note_actual": note_actual,
            "f_standard": round(f_standard, 2),
            "cents": round(cents, 2),
            "a4_actual": a4_actual_rounded,
            "recommendation_standard": rec_standard,
            "recommendation_custom": rec_custom
        }
        
        logging.info("Analysis completed successfully")
        return jsonify(response_data)

    except Exception as e:
        logging.error(f"Error processing audio: {str(e)}")
        return jsonify({"error": f"حدث خطأ في الخادم: {str(e)}"}), 500
    
    try:
        print("Processing audio file in-memory")
        # Pass the file-like object directly to librosa
        y, sr = librosa.load(audio_file, sr=None, mono=True)
        
        print(f"Audio loaded with librosa. Sample rate: {sr}, Duration: {len(y)/sr:.2f}s")

        # Improve audio processing
        y = librosa.effects.preemphasis(y)
        
        # Pitch detection with more precise parameters
        f0, voiced_flag, voiced_probs = librosa.pyin(
            y, 
            fmin=librosa.note_to_hz('C2'),
            fmax=librosa.note_to_hz('C7'),
            frame_length=2048,
            win_length=1024,
            hop_length=512,
            center=True,
            sr=sr
        )
        
        # Filter out NaN values and low confidence predictions
        f0_voiced = f0[np.isfinite(f0) & voiced_flag & (voiced_probs > 0.6)]
        
        print(f"Pitch detection complete. Found {len(f0_voiced)} voiced frames with high confidence.")

        if len(f0_voiced) < 5: # Require a minimum number of voiced frames for a stable pitch
            print("Error: Not enough voiced frames detected.")
            return jsonify({"error": "لم يتمكن من تحديد نغمة واضحة. يرجى النفخ بشكل أطول وأكثر ثباتًا."}), 400
            
        f_actual = np.median(f0_voiced)
        print(f"Calculated median frequency (f_actual): {f_actual:.2f} Hz")

        # Find the nearest standard note and its frequency
        note_actual, f_standard = get_base_note_and_freq(f_actual)

        # 1. Calculate deviation in Cents
        if f_actual <= 0 or f_standard <= 0:
            return jsonify({"error": "تردد غير صالح"}), 400
        
        cents = 1200 * math.log2(f_actual / f_standard)

        # 2. Apply deviation to A4 reference
        a4_actual = 440 * (2**(cents / 1200))

        # 3. Generate recommendation
        a4_actual_rounded = round(a4_actual, 2)
        
        # This calculation determines what a standard 440Hz ney would produce with your breath
        ney_at_440_produces = round(440 * (a4_actual / 440), 2)

        # This calculation determines the ideal tuning of a ney that would produce a perfect 440Hz with your breath
        ideal_ney_for_440 = round(440 * (440 / a4_actual), 2)

        rec_standard = f"إذا عزفت على ناي قياسي (440 ذ/ث)، ستكون النغمة الناتجة {ney_at_440_produces} ذ/ث. للحصول على نغمة 440 ذ/ث مضبوطة، تحتاج إلى ناي بمقياس {ideal_ney_for_440} ذ/ث."
        rec_custom = f"مقياس نفختك الفعلي هو {a4_actual_rounded} ذ/ث."


    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": f"حدث خطأ في الخادم: {e}"}), 500

    return jsonify({
        "f_actual": round(f_actual, 2),
        "note_actual": note_actual,
        "f_standard": round(f_standard, 2),
        "cents": round(cents, 2),
        "a4_actual": a4_actual_rounded,
        "recommendation_standard": rec_standard,
        "recommendation_custom": rec_custom
    })

if __name__ == '__main__':
    app.run(debug=True)
