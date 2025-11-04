class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
    }

    async init() {
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    channelCount: 1,
                    sampleRate: 44100,
                    sampleSize: 16,
                    volume: 1.0
                }
            });

            this.mediaRecorder = new MediaRecorder(this.stream);
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };

            return true;
        } catch (error) {
            console.error('Error initializing recorder:', error);
            return false;
        }
    }

    start() {
        this.audioChunks = [];
        this.mediaRecorder.start();
    }

    stop() {
        return new Promise((resolve) => {
            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.audioChunks, { type: 'audio/wav' });
                resolve(blob);
            };
            this.mediaRecorder.stop();
        });
    }

    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
        }
        this.audioChunks = [];
        this.mediaRecorder = null;
        this.stream = null;
    }
}
