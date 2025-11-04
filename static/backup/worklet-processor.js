class RecorderWorkletProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.recording = false;
        this.buffers = [];
    }

    process(inputs, outputs, parameters) {
        if (this.recording && inputs[0].length > 0) {
            // Clone the input data
            const buffer = inputs[0][0].slice();
            this.buffers.push(buffer);
            
            // Send buffer to the main thread when we have enough data
            if (this.buffers.length >= 128) {
                this.port.postMessage({
                    command: 'buffer',
                    buffer: this.buffers
                });
                this.buffers = [];
            }
        }
        return true;
    }

    // Handle messages from the main thread
    port.onmessage = (e) => {
        if (e.data.command === 'start') {
            this.recording = true;
            this.buffers = [];
        } else if (e.data.command === 'stop') {
            this.recording = false;
            if (this.buffers.length > 0) {
                this.port.postMessage({
                    command: 'buffer',
                    buffer: this.buffers
                });
                this.buffers = [];
            }
        }
    };
}

registerProcessor('recorder-worklet', RecorderWorkletProcessor);
