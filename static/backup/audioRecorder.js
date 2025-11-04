class AudioRecorder {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.stream = null;
        this.audioContext = null;
    }

    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)({
                sampleRate: 44100
            });
            
            const constraints = {
                audio: {
                    channelCount: 1,
                    sampleRate: 44100,
                    sampleSize: 16
                }
            };

            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.mediaRecorder = new MediaRecorder(this.stream, {
                mimeType: 'audio/webm;codecs=opus'
            });

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
        if (this.mediaRecorder && this.mediaRecorder.state === 'inactive') {
            this.audioChunks = [];
            this.mediaRecorder.start(100); // Record in 100ms chunks
        }
    }

    async stop() {
        return new Promise((resolve) => {
            if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
                this.mediaRecorder.onstop = async () => {
                    // Convert webm to wav
                    const webmBlob = new Blob(this.audioChunks, { type: 'audio/webm;codecs=opus' });
                    const wavBlob = await this.convertToWav(webmBlob);
                    resolve(wavBlob);
                };
                this.mediaRecorder.stop();
            } else {
                resolve(null);
            }
        });
    }

    async convertToWav(webmBlob) {
        const audioBuffer = await this.audioContext.decodeAudioData(await webmBlob.arrayBuffer());
        const wavBuffer = this.audioBufferToWav(audioBuffer);
        return new Blob([wavBuffer], { type: 'audio/wav' });
    }

    audioBufferToWav(audioBuffer) {
        const numOfChan = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChan * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        let offset = 0;

        // Write WAV header
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        // Write WAV header chunks
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numOfChan, true);
        view.setUint32(24, audioBuffer.sampleRate, true);
        view.setUint32(28, audioBuffer.sampleRate * numOfChan * 2, true);
        view.setUint16(32, numOfChan * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, length, true);

        // Write audio data
        offset = 44;
        const channelData = [];
        for (let i = 0; i < numOfChan; i++) {
            channelData[i] = audioBuffer.getChannelData(i);
        }

        for (let i = 0; i < audioBuffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                const sample = channelData[channel][i];
                view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
                offset += 2;
            }
        }

        return buffer;
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
