class Recorder {
    constructor(source, config) {
        this.source = source;
        this.context = source.context;
        this.config = {
            numChannels: 1,
            mimeType: 'audio/wav',
            ...config
        };
        
        this.chunks = [];
        this.recording = false;
        this.callbacks = {
            getBuffer: [],
            exportWAV: []
        };

        // Initialize the audio buffer
        this.initBuffer();
    }

    async initBuffer() {
        // Create a buffer source
        const bufferSize = 4096;
        this.audioBuffer = this.context.createBuffer(
            this.config.numChannels,
            bufferSize,
            this.context.sampleRate
        );
    }

    record() {
        this.recording = true;
        this.chunks = [];
        
        // Create a new MediaRecorder instance
        this.mediaRecorder = new MediaRecorder(this.source.mediaStream, {
            mimeType: 'audio/webm;codecs=opus'
        });

        this.mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
                this.chunks.push(e.data);
            }
        };

        this.mediaRecorder.start();
    }

    stop() {
        return new Promise((resolve) => {
            this.mediaRecorder.onstop = async () => {
                resolve();
            };
            this.mediaRecorder.stop();
            this.recording = false;
        });
    }

    clear() {
        this.chunks = [];
    }

    async exportWAV(cb) {
        if (this.chunks.length === 0) {
            cb(null);
            return;
        }

        const blob = new Blob(this.chunks, { type: 'audio/webm;codecs=opus' });
        
        // Convert to WAV if needed
        if (this.config.mimeType === 'audio/wav') {
            try {
                const arrayBuffer = await blob.arrayBuffer();
                const audioContext = new (window.AudioContext || window.webkitAudioContext)();
                const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
                
                // Convert to WAV
                const wavBlob = this.audioBufferToWav(audioBuffer);
                cb(wavBlob);
            } catch (error) {
                console.error('Error converting to WAV:', error);
                cb(null);
            }
        } else {
            cb(blob);
        }
    }

    audioBufferToWav(audioBuffer) {
        const numOfChan = audioBuffer.numberOfChannels;
        const length = audioBuffer.length * numOfChan * 2;
        const buffer = new ArrayBuffer(44 + length);
        const view = new DataView(buffer);
        const channels = [];
        let offset = 0;
        let pos = 0;

        // Get channel data
        for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
            channels.push(audioBuffer.getChannelData(i));
        }

        // Write WAV header
        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + length, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numOfChan, true);
        view.setUint32(24, audioBuffer.sampleRate, true);
        view.setUint32(28, audioBuffer.sampleRate * 2 * numOfChan, true);
        view.setUint16(32, numOfChan * 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, length, true);

        // Write PCM data
        if (numOfChan === 2) {
            let inputL = channels[0];
            let inputR = channels[1];
            while (pos < length) {
                view.setInt16(pos + 44, inputL[offset] * 0x7FFF, true);
                view.setInt16(pos + 46, inputR[offset] * 0x7FFF, true);
                pos += 4;
                offset++;
            }
        } else {
            let input = channels[0];
            while (pos < length) {
                view.setInt16(pos + 44, input[offset] * 0x7FFF, true);
                pos += 2;
                offset++;
            }
        }

        return new Blob([buffer], { type: 'audio/wav' });
    }
}

function writeString(view, offset, string) {
    for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
    }
}

// Make the Recorder class available globally
window.Recorder = Recorder;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({
    1:[function(require,module,exports){
      "use strict";

      module.exports = require("./recorder").Recorder;

    }, {"./recorder":2}],
    2:[function(require,module,exports){
      'use strict';

      var _createClass = (function () {
        function defineProperties(target, props) {
          for (var i = 0; i < props.length; i++) {
            var descriptor = props[i];
            descriptor.enumerable = descriptor.enumerable || false;
            descriptor.configurable = true;
            if ("value" in descriptor) descriptor.writable = true;
            Object.defineProperty(target, descriptor.key, descriptor);
          }
        }

        return function (Constructor, protoProps, staticProps) {
          if (protoProps) defineProperties(Constructor.prototype, protoProps);
          if (staticProps) defineProperties(Constructor, staticProps);
          return Constructor;
        };
      })();

      Object.defineProperty(exports, "__esModule", {
        value: true
      });
      exports.Recorder = undefined;

      var _inlineWorker = require('inline-worker');

      var _inlineWorker2 = _interopRequireDefault(_inlineWorker);

      function _interopRequireDefault(obj) {
        return obj && obj.__esModule ? obj : {default: obj};
      }

      function _classCallCheck(instance, Constructor) {
        if (!(instance instanceof Constructor)) {
          throw new TypeError("Cannot call a class as a function");
        }
      }

      var Recorder = exports.Recorder = (function () {
        function Recorder(source, cfg) {
          var _this = this;

          _classCallCheck(this, Recorder);

          this.config = {
            bufferLen: 4096,
            numChannels: 2,
            mimeType: 'audio/wav'
          };
          this.recording = false;
          this.callbacks = {
            getBuffer: [],
            exportWAV: []
          };

          Object.assign(this.config, cfg);
          this.context = source.context;
          this.node = (this.context.createScriptProcessor || this.context.createJavaScriptNode).call(this.context, this.config.bufferLen, this.config.numChannels, this.config.numChannels);

          this.node.onaudioprocess = function (e) {
            if (!_this.recording) return;

            var buffer = [];
            for (var channel = 0; channel < _this.config.numChannels; channel++) {
              buffer.push(e.inputBuffer.getChannelData(channel));
            }
            _this.worker.postMessage({
              command: 'record',
              buffer: buffer
            });
          };

          source.connect(this.node);
          this.node.connect(this.context.destination); //this should not be necessary

          var self = {};
          this.worker = new _inlineWorker2.default(function () {
            var recLength = 0,
                recBuffers = [],
                sampleRate = undefined,
                numChannels = undefined;

            self.onmessage = function (e) {
              switch (e.data.command) {
                case 'init':
                  init(e.data.config);
                  break;
                case 'record':
                  record(e.data.buffer);
                  break;
                case 'exportWAV':
                  exportWAV(e.data.type);
                  break;
                case 'getBuffer':
                  getBuffer();
                  break;
                case 'clear':
                  clear();
                  break;
              }
            };

            function init(config) {
              sampleRate = config.sampleRate;
              numChannels = config.numChannels;
              initBuffers();
            }

            function record(inputBuffer) {
              for (var channel = 0; channel < numChannels; channel++) {
                recBuffers[channel].push(inputBuffer[channel]);
              }
              recLength += inputBuffer[0].length;
            }

            function exportWAV(type) {
              var buffers = [];
              for (var channel = 0; channel < numChannels; channel++) {
                buffers.push(mergeBuffers(recBuffers[channel], recLength));
              }
              var interleaved = undefined;
              if (numChannels === 2) {
                interleaved = interleave(buffers[0], buffers[1]);
              } else {
                interleaved = buffers[0];
              }
              var dataview = encodeWAV(interleaved);
              var audioBlob = new Blob([dataview], {type: type});

              self.postMessage({command: 'exportWAV', data: audioBlob});
            }

            function getBuffer() {
              var buffers = [];
              for (var channel = 0; channel < numChannels; channel++) {
                buffers.push(mergeBuffers(recBuffers[channel], recLength));
              }
              self.postMessage({command: 'getBuffer', data: buffers});
            }

            function clear() {
              recLength = 0;
              recBuffers = [];
              initBuffers();
            }

            function initBuffers() {
              for (var channel = 0; channel < numChannels; channel++) {
                recBuffers[channel] = [];
              }
            }

            function mergeBuffers(recBuffers, recLength) {
              var result = new Float32Array(recLength);
              var offset = 0;
              for (var i = 0; i < recBuffers.length; i++) {
                result.set(recBuffers[i], offset);
                offset += recBuffers[i].length;
              }
              return result;
            }

            function interleave(inputL, inputR) {
              var length = inputL.length + inputR.length;
              var result = new Float32Array(length);

              var index = 0,
                  inputIndex = 0;

              while (index < length) {
                result[index++] = inputL[inputIndex];
                result[index++] = inputR[inputIndex];
                inputIndex++;
              }
              return result;
            }

            function floatTo16BitPCM(output, offset, input) {
              for (var i = 0; i < input.length; i++, offset += 2) {
                var s = Math.max(-1, Math.min(1, input[i]));
                output.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
              }
            }

            function writeString(view, offset, string) {
              for (var i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
              }
            }

            function encodeWAV(samples) {
              var buffer = new ArrayBuffer(44 + samples.length * 2);
              var view = new DataView(buffer);

              /* RIFF identifier */
              writeString(view, 0, 'RIFF');
              /* RIFF chunk length */
              view.setUint32(4, 36 + samples.length * 2, true);
              /* RIFF type */
              writeString(view, 8, 'WAVE');
              /* format chunk identifier */
              writeString(view, 12, 'fmt ');
              /* format chunk length */
              view.setUint32(16, 16, true);
              /* sample format (raw) */
              view.setUint16(20, 1, true);
              /* channel count */
              view.setUint16(22, numChannels, true);
              /* sample rate */
              view.setUint32(24, sampleRate, true);
              /* byte rate (sample rate * block align) */
              view.setUint32(28, sampleRate * 4, true);
              /* block align (channel count * bytes per sample) */
              view.setUint16(32, numChannels * 2, true);
              /* bits per sample */
              view.setUint16(34, 16, true);
              /* data chunk identifier */
              writeString(view, 36, 'data');
              /* data chunk length */
              view.setUint32(40, samples.length * 2, true);

              floatTo16BitPCM(view, 44, samples);

              return view;
            }
          }, self);

          this.worker.postMessage({
            command: 'init',
            config: {
              sampleRate: this.context.sampleRate,
              numChannels: this.config.numChannels
            }
          });

          this.worker.onmessage = function (e) {
            var cb = _this.callbacks[e.data.command].pop();
            if (typeof cb == 'function') {
              cb(e.data.data);
            }
          };
        }
