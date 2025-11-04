// تهيئة المتغيرات العالمية
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

document.addEventListener("DOMContentLoaded", function() {
    // عناصر واجهة المستخدم
    const recordButton = document.getElementById("recordButton");
    const statusElement = document.getElementById("status");
    const resultsSection = document.getElementById("results");

    // طلب إذن الميكروفون
    navigator.mediaDevices.getUserMedia({ audio: true })
        .then(function(stream) {
            mediaRecorder = new MediaRecorder(stream);
            setupRecorder();
        })
        .catch(function(error) {
            console.error("Error:", error);
            showStatus("لم يتم العثور على ميكروفون أو تم رفض الإذن", "alert-danger");
        });

    function setupRecorder() {
        // تجميع بيانات التسجيل
        mediaRecorder.ondataavailable = function(event) {
            audioChunks.push(event.data);
        };

        // عند إيقاف التسجيل: نحاول تحويل التسجيل داخلياً إلى WAV PCM قبل الإرسال
        mediaRecorder.onstop = async function() {
            // دمج القطع المسجلة في Blob واحد (عادة تكون webm/opus)
            const recordedBlob = new Blob(audioChunks, { type: audioChunks[0]?.type || 'audio/webm' });

            // دالة مساعدة لتحويل AudioBuffer إلى ArrayBuffer بتنسيق WAV (16-bit PCM)
            function audioBufferToWav(buffer) {
                const numOfChan = buffer.numberOfChannels;
                const length = buffer.length * numOfChan * 2 + 44;
                const arrayBuffer = new ArrayBuffer(length);
                const view = new DataView(arrayBuffer);

                function writeString(view, offset, string) {
                    for (let i = 0; i < string.length; i++) {
                        view.setUint8(offset + i, string.charCodeAt(i));
                    }
                }

                let offset = 0;
                writeString(view, offset, 'RIFF'); offset += 4;
                view.setUint32(offset, length - 8, true); offset += 4;
                writeString(view, offset, 'WAVE'); offset += 4;
                writeString(view, offset, 'fmt '); offset += 4;
                view.setUint32(offset, 16, true); offset += 4; // Subchunk1Size
                view.setUint16(offset, 1, true); offset += 2; // PCM
                view.setUint16(offset, numOfChan, true); offset += 2;
                view.setUint32(offset, buffer.sampleRate, true); offset += 4;
                view.setUint32(offset, buffer.sampleRate * numOfChan * 2, true); offset += 4; // byte rate
                view.setUint16(offset, numOfChan * 2, true); offset += 2; // block align
                view.setUint16(offset, 16, true); offset += 2; // bits per sample
                writeString(view, offset, 'data'); offset += 4;
                view.setUint32(offset, length - offset - 4, true); offset += 4;

                // write interleaved PCM samples
                const interleaved = new Int16Array((length - 44) / 2);
                let idx = 0;
                const channels = [];
                for (let c = 0; c < numOfChan; c++) channels.push(buffer.getChannelData(c));
                for (let i = 0; i < buffer.length; i++) {
                    for (let c = 0; c < numOfChan; c++) {
                        let sample = Math.max(-1, Math.min(1, channels[c][i]));
                        interleaved[idx++] = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                    }
                }

                // copy PCM data to DataView
                for (let i = 0; i < interleaved.length; i++) {
                    view.setInt16(44 + i * 2, interleaved[i], true);
                }

                return arrayBuffer;
            }

            // نحاول فك ترميز التسجيل باستعمال AudioContext ثم نرسله كـ WAV
            try {
                showStatus('جاري تحويل التسجيل إلى WAV محلياً...', 'alert-info');
                const arrayBuffer = await recordedBlob.arrayBuffer();
                const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                const decoded = await audioCtx.decodeAudioData(arrayBuffer);
                const wavArrayBuffer = audioBufferToWav(decoded);
                const wavBlob = new Blob([wavArrayBuffer], { type: 'audio/wav' });

                const formData = new FormData();
                formData.append('audio_data', wavBlob, 'recording.wav');

                showStatus('جاري تحليل التسجيل...', 'alert-info');

                // أرسل الملف المحول
                fetch('/analyze', { method: 'POST', body: formData })
                .then(function(response) {
                    return response.text().then(function(text) {
                        let parsed = null;
                        try { parsed = JSON.parse(text); } catch(e) { parsed = null; }
                        if (!response.ok) {
                            if (parsed && parsed.error) throw new Error(parsed.error);
                            const msg = (typeof text === 'string' && text.trim().length > 0) ? text : 'خطأ في الخادم';
                            throw new Error(msg);
                        }
                        return parsed || (text ? text : {});
                    });
                })
                .then(function(data) {
                    displayResults(data);
                    showStatus('تم تحليل التسجيل بنجاح', 'alert-success');
                    setTimeout(function() { statusElement.classList.add('d-none'); }, 3000);
                })
                .catch(function(error) {
                    console.error('Error:', error);
                    showStatus(error.message || 'حدث خطأ أثناء تحليل التسجيل', 'alert-danger');
                });

            } catch (err) {
                // إذا فشل التحويل المحلي (بعض المتصفحات قد لا تدعم فك webm)، نرسل الملف كما هو
                console.warn('Local WAV conversion failed, sending original blob:', err);
                showStatus('لم أتمكن من تحويل التسجيل محلياً، سأرسل الملف كما هو إلى الخادم...', 'alert-warning');
                const formData = new FormData();
                formData.append('audio_data', recordedBlob, 'recording.webm');

                fetch('/analyze', { method: 'POST', body: formData })
                .then(function(response) {
                    return response.text().then(function(text) {
                        let parsed = null;
                        try { parsed = JSON.parse(text); } catch(e) { parsed = null; }
                        if (!response.ok) {
                            if (parsed && parsed.error) throw new Error(parsed.error);
                            const msg = (typeof text === 'string' && text.trim().length > 0) ? text : 'خطأ في الخادم';
                            throw new Error(msg);
                        }
                        return parsed || (text ? text : {});
                    });
                })
                .then(function(data) {
                    displayResults(data);
                    showStatus('تم تحليل التسجيل بنجاح', 'alert-success');
                    setTimeout(function() { statusElement.classList.add('d-none'); }, 3000);
                })
                .catch(function(error) {
                    console.error('Error:', error);
                    showStatus(error.message || 'حدث خطأ أثناء تحليل التسجيل', 'alert-danger');
                });
            }
        };
    }

    // زر التسجيل
    recordButton.addEventListener("click", function() {
        if (!isRecording) startRecording(); else stopRecording();
    });

    function startRecording() {
        if (!mediaRecorder) return;
        audioChunks = [];
        mediaRecorder.start();
        isRecording = true;
        updateButton(true);
        showStatus("جاري التسجيل...، انفخ في الناي بنغمة ثابتة", "alert-info");
        resultsSection.classList.remove("visible");
    }

    function stopRecording() {
        if (!mediaRecorder) return;
        mediaRecorder.stop();
        isRecording = false;
        updateButton(false);
    }

    function updateButton(recording) {
        recordButton.classList.toggle("btn-success", !recording);
        recordButton.classList.toggle("btn-danger", recording);
        const icon = recording ?
            '<path d="M6 6h12v12H6z"/>' :
            '<path d="M12 15c1.66 0 3-1.34 3-3V6c0-1.66-1.34-3-3-3S9 4.34 9 6v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V6z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>';
        recordButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="record-icon">' + icon + '</svg>' + '<span>' + (recording ? 'إيقاف التسجيل' : 'ابدأ التسجيل') + '</span>';
    }

    function showStatus(message, className) {
        statusElement.textContent = message;
        statusElement.className = "alert " + className;
        statusElement.classList.remove("d-none");
    }

    function displayResults(data) {
        // عرض القيم الأساسية
        document.getElementById("frequency").textContent = parseFloat(data.f_actual).toFixed(1);
        document.getElementById("f_standard").textContent = parseFloat(data.f_standard).toFixed(1) + " هرتز";
        document.getElementById("note_actual").textContent = data.note_actual;
        document.getElementById("cents").textContent = parseFloat(data.cents).toFixed(1) + " سنت";
        document.getElementById("recommendation_custom").textContent = data.recommendation_custom || "";

        // إعداد نص التوصيات بطريقة مرتبة للمستخدم
        let recommendationText = "بناءً على التحليل:\n";
        recommendationText += "• التردد المقاس: " + parseFloat(data.f_actual).toFixed(1) + " هرتز\n";
        recommendationText += "• النغمة الأقرب: " + data.note_actual + "\n";
        recommendationText += "• الانحراف: " + parseFloat(data.cents).toFixed(1) + " سنت\n";
        if (data.recommendation_standard) recommendationText += "\n" + data.recommendation_standard;

        // نعرض النسخة المنسقة للعرض (HTML) ونسخة نصية للـ aria أو التنزيل لاحقًا
        document.getElementById("recommendation_standard").innerHTML = recommendationText.replace(/\n/g, "<br>");

        resultsSection.classList.add("visible");
        resultsSection.scrollIntoView({ behavior: "smooth" });
    }
});
