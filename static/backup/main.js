document.addEventListener("DOMContentLoaded", () => {
    const recordButton = document.getElementById("recordButton");
    const statusDiv = document.getElementById("status");
    const resultsDiv = document.getElementById("results");
    
    const recorder = new AudioRecorder();
    let isRecording = false;

    async function sendAudioToServer(blob) {
        if (!blob) {
            statusDiv.textContent = "خطأ: لم يتم تسجيل أي صوت";
            return;
        }

        const formData = new FormData();
        formData.append("audio_data", blob, "recording.wav");

        try {
            statusDiv.textContent = "جاري تحليل التسجيل...";
            const response = await fetch("/analyze", {
                method: "POST",
                body: formData
            });

            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.error || `خطأ في الخادم: ${response.status}`);
            }

            displayResults(data);
            statusDiv.textContent = "اكتمل التحليل بنجاح!";
        } catch (error) {
            statusDiv.textContent = `حدث خطأ أثناء التحليل: ${error.message}`;
            console.error("Analysis error:", error);
        }
    }

    function displayResults(data) {
        if (!data) return;
        
        document.getElementById("f_actual").textContent = data.f_actual;
        document.getElementById("note_actual").textContent = data.note_actual;
        document.getElementById("f_standard").textContent = data.f_standard;
        document.getElementById("cents").textContent = data.cents;
        document.getElementById("a4_actual").textContent = data.a4_actual;
        document.getElementById("recommendation_standard").textContent = data.recommendation_standard;
        document.getElementById("recommendation_custom").textContent = data.recommendation_custom;
        resultsDiv.style.display = "block";
    }

    recordButton.addEventListener("click", async () => {
        try {
            if (isRecording) {
                // Stop recording
                recordButton.disabled = true;
                statusDiv.textContent = "جاري إيقاف التسجيل...";
                
                const audioBlob = await recorder.stop();
                isRecording = false;
                
                // Update UI
                recordButton.classList.remove("recording", "btn-danger");
                recordButton.classList.add("btn-success");
                recordButton.innerHTML = `
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-mic-fill" viewBox="0 0 16 16">
                        <path d="M5 3a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V3z"/>
                        <path d="M3.5 6.5A.5.5 0 0 1 4 7v1a4 4 0 0 0 8 0V7a.5.5 0 0 1 1 0v1a5 5 0 0 1-4.5 4.975V15h3a.5.5 0 0 1 0 1h-7a.5.5 0 0 1 0-1h3v-2.025A5 5 0 0 1 3 8V7a.5.5 0 0 1 .5-.5z"/>
                    </svg>
                    بدء التسجيل
                `;
                
                await sendAudioToServer(audioBlob);
                recorder.cleanup();
                recordButton.disabled = false;
                
            } else {
                // Start recording
                if (await recorder.init()) {
                    recorder.start();
                    isRecording = true;
                    
                    recordButton.classList.add("recording", "btn-danger");
                    recordButton.classList.remove("btn-success");
                    recordButton.innerHTML = `
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" class="bi bi-stop-circle-fill" viewBox="0 0 16 16">
                            <path d="M16 8A8 8 0 1 1 0 8a8 8 0 0 1 16 0zM6.5 5A1.5 1.5 0 0 0 5 6.5v3A1.5 1.5 0 0 0 6.5 11h3A1.5 1.5 0 0 0 11 9.5v-3A1.5 1.5 0 0 0 9.5 5h-3z"/>
                        </svg>
                        إيقاف التسجيل
                    `;
                    
                    statusDiv.textContent = "جارٍ التسجيل... انفخ في الناي بنغمة ثابتة.";
                    resultsDiv.style.display = "none";
                } else {
                    statusDiv.textContent = "خطأ: لم يتمكن من الوصول إلى الميكروفون. يرجى السماح بالوصول وتحديث الصفحة.";
                }
            }
        } catch (error) {
            console.error("Error in recording:", error);
            statusDiv.textContent = "حدث خطأ في التسجيل. يرجى تحديث الصفحة والمحاولة مرة أخرى.";
            isRecording = false;
            recorder.cleanup();
            recordButton.disabled = false;
        }
    });
});
