// This file was moved to static/backup/recorder.js
// Kept here as a placeholder to avoid accidental usage. The original content
// can be found in `static/backup/recorder.js`.

/* DO NOT EDIT - backup copy exists. */
        _createClass(Recorder, [{
          key: 'record',
          value: function record() {
            this.recording = true;
          }
        }, {
          key: 'stop',
          value: function stop() {
            this.recording = false;
          }
        }, {
          key: 'clear',
          value: function clear() {
            this.worker.postMessage({command: 'clear'});
          }
        }, {
          key: 'getBuffer',
          value: function getBuffer(cb) {
            cb = cb || this.config.callback;
            if (!cb) throw new Error('Callback not set');

            this.callbacks.getBuffer.push(cb);

            this.worker.postMessage({command: 'getBuffer'});
          }
        }, {
          key: 'exportWAV',
          value: function exportWAV(cb, mimeType) {
            mimeType = mimeType || this.config.mimeType;
            cb = cb || this.config.callback;
            if (!cb) throw new Error('Callback not set');

            this.callbacks.exportWAV.push(cb);

            this.worker.postMessage({
              command: 'exportWAV',
              type: mimeType
            });
          }
        }], [{
          key: 'forceDownload',
          value: function forceDownload(blob, filename) {
            var url = (window.URL || window.webkitURL).createObjectURL(blob);
            var link = window.document.createElement('a');
            link.href = url;
            link.download = filename || 'output.wav';
            var click = document.createEvent("Event");
            click.initEvent("click", true, true);
            link.dispatchEvent(click);
          }
        }]);

        return Recorder;
      })();

      exports.default = Recorder;

    }, {"inline-worker":3}],
    3:[function(require,module,exports){
      "use strict";

      module.exports = require("./inline-worker");
    }, {"./inline-worker":4}],
    4:[function(require,module,exports){
      (function (global){
        "use strict";

        var _createClass = (function () {
          function defineProperties(target, props) {
            for (var key in props) {
              var prop = props[key];
              prop.configurable = true;
              if (prop.value) prop.writable = true;
            }
            Object.defineProperties(target, props);
          }

          return function (Constructor, protoProps, staticProps) {
            if (protoProps) defineProperties(Constructor.prototype, protoProps);
            if (staticProps) defineProperties(Constructor, staticProps);
            return Constructor;
          };
        })();

        var _classCallCheck = function (instance, Constructor) {
          if (!(instance instanceof Constructor)) {
            throw new TypeError("Cannot call a class as a function");
          }
        };

        var WORKER_ENABLED = !!(global === global.window && global.URL && global.Blob && global.Worker);

        var InlineWorker = (function () {
          function InlineWorker(func, self) {
            var _this = this;

            _classCallCheck(this, InlineWorker);

            if (WORKER_ENABLED) {
              var functionBody = func.toString().trim().match(/^function\s*\w*\s*\([\w\s,]*\)\s*{([\w\W]*?)}$/)[1];
              var url = global.URL.createObjectURL(new global.Blob([functionBody], {type: "text/javascript"}));

              return new global.Worker(url);
            }

            this.self = self;
            this.self.postMessage = function (data) {
              setTimeout(function () {
                _this.onmessage({data: data});
              }, 0);
            };

            setTimeout(function () {
              func.call(self);
            }, 0);
          }

          _createClass(InlineWorker, {
            postMessage: {
              value: function postMessage(data) {
                var _this = this;

                setTimeout(function () {
                  _this.self.onmessage({data: data});
                }, 0);
              }
            }
          });

          return InlineWorker;
        })();

        module.exports = InlineWorker;
      }).call(this,typeof global!=="undefined"?global:typeof self!=="undefined"?self:typeof window!=="undefined"?window:{})
    },{}]
  },{},[1])(1)
});