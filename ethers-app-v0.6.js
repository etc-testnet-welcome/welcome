(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
(function (global){
'use strict';

const ethersLib = require('ethers');
const Contract  = ethersLib.Contract;
const providers = ethersLib.providers;
const utils     = ethersLib.utils;

var ProviderBridge = require('ethers-web3-bridge');

function defineCallback(object, name) {
    var callback = null;

    Object.defineProperty(object, name, {
        enumerable: true,
        get: function() { return callback; },
        set: function(value) {
            callback = value;
        }
    });
}

function ethersLog() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift('[Ethers Client Library]');
    var onlyStrings = true;
    args.forEach(function(arg) {
        if (typeof(arg) !== 'string') { onlyStrings = false; }
    });
    if (onlyStrings) { args = [ args.join(' ') ]; }
    console.log.apply(console, args);
}

function proxyObject(object, deferProperties, chainProperties, syncProperties) {
    var setProxy = null;
    var proxyTarget = null;
    var proxyPromise = new Promise(function(resolve) {
        setProxy = function(value) {
            proxyTarget = value;
            resolve(proxyTarget);
            setProxy = null;
        }
    });

    deferProperties.forEach(function(property) {
        utils.defineReadOnly(object, property, function() {
            var targetArgs = Array.prototype.slice.call(arguments);
            return proxyPromise.then(function(proxyTarget) {
                return proxyTarget[property].apply(proxyTarget, targetArgs);
            });
        });
    });

    chainProperties.forEach(function(property) {
        utils.defineReadOnly(object, property, function() {
            var targetArgs = Array.prototype.slice.call(arguments);
            proxyPromise.then(function(proxyTarget) {
                proxyTarget[property].apply(proxyTarget, targetArgs);
            });
            return object;
        });
    });

    syncProperties.forEach(function(property) {
        Object.defineProperty(object, property, {
            enumerable: true,
            get: function() {
                if (!proxyTarget) { throw new Error('cannot access property before connection: ' + property); }
                return proxyTarget[property];
            }
        });
    });

    utils.defineReadOnly(object, 'ready', function() {
        return proxyPromise.then(function(proxyTarget) {
            return null;
        });
    });

    return setProxy;
}


function Provider() { }
var provider = new Provider();
var setProviderProxyTarget = proxyObject(provider, [
    'getBlockNumber',
    'getGasPrice',
    'getBalance',
    'getTransactionCount',
    'getCode',
    'getStorageAt',
    'call',
    'estimateGas',
    'getBlock',
    'getTransaction',
    'getTransactionReceipt',
    'getLogs',
    'resolveName',
    'waitForTransaction',
], [
    'on',
    'once',
    'removeAllListeners',
    'removeListener'
], [
    'listenerCount',
    'listeners',
    'chainId',
    'ensAddress',
    'name',
]);


function Signer() { }
var signer = new Signer();
utils.defineReadOnly(signer, 'provider', provider);
var setSignerProxyTarget = proxyObject(signer, [
    'getAddress',
    'getBalance',
    'sendTransaction',
    'signMessage',
], [ ], [ ]);



var ethers = {}

utils.defineReadOnly(ethers, 'provider', provider);
utils.defineReadOnly(ethers, 'signer', signer);

var exportUtils = {};
utils.defineReadOnly(ethers, 'utils', exportUtils);

var blockchain = {};
utils.defineReadOnly(ethers, 'blockchain', blockchain);

// onready - After we have finished loading and registered with ethers.io
var onready = (function() {
    var ready = false;

    var callback = null;
    function trigger() {
        ethersLog('Ready');
        ready = true;
        if (!callback) { return; }
        var cb = callback;
        setTimeout(function() { cb(); });
    }

    Object.defineProperty(ethers, 'onready', {
        enumerable: true,
        get: function() { return callback; },
        set: function(value) {
            callback = value;
            if (ready) { trigger(); }
        }
    });

    return trigger;
})();

// onaccount - Whenever the user switches to a new account
defineCallback(ethers, 'onaccount');


// ethers
utils.defineReadOnly(ethers, 'getAddress', utils.getAddress);

utils.defineReadOnly(ethers, 'formatEther', utils.formatEther);
utils.defineReadOnly(ethers, 'parseEther', utils.parseEther);

utils.defineReadOnly(ethers, 'formatUnits', utils.formatUnits);
utils.defineReadOnly(ethers, 'parseUnits', utils.parseUnits);

utils.defineReadOnly(ethers, 'etherSymbol', utils.etherSymbol);


// ethers.utils
utils.defineReadOnly(exportUtils, 'arrayify', utils.arrayify);
utils.defineReadOnly(exportUtils, 'bigNumberify', utils.bigNumberify);
utils.defineReadOnly(exportUtils, 'concat', utils.concat);
utils.defineReadOnly(exportUtils, 'hexlify', utils.hexlify);
utils.defineReadOnly(exportUtils, 'id', utils.id);
utils.defineReadOnly(exportUtils, 'keccak256', utils.keccak256);
utils.defineReadOnly(exportUtils, 'sha256', utils.sha256);

utils.defineReadOnly(exportUtils, 'solidityKeccak256', utils.solidityKeccak256);
utils.defineReadOnly(exportUtils, 'soliditySha256', utils.soliditySha256);
utils.defineReadOnly(exportUtils, 'splitSignature', utils.splitSignature);

utils.defineReadOnly(exportUtils, 'namehash', utils.namehash);

utils.defineReadOnly(exportUtils, 'toUtf8Bytes', utils.toUtf8Bytes);
utils.defineReadOnly(exportUtils, 'toUtf8String', utils.toUtf8String);

utils.defineReadOnly(exportUtils, 'getContractAddress', utils.getContractAddress);


utils.defineReadOnly(ethers, 'getContract', function(address, abi) {
    if (arguments.length === 2) {
        return Promise.resolve(new Contract(address, abi, ethers.signer));
    }

    if (arguments.length === 1) {
        if (address.match(/\.json/)) {
            return Promise.all([
                providers.Provider.fetchJSON(address),
                ethers.getNetwork()
            ]).then(function(result) {
                var data = result[0];
                if (data) { data = data[result[1]]; }
                if (data) {
                    try {
                        var address = utils.getAddress(data.address);
                    } catch (error) {
                        return Promise.reject(new Error('error loading contract - address=' + data.address));
                    }
                    try {
                        return new Contract(data.address, data.interface, ethers.signer);
                    } catch (error) {
                        return Promise.reject(new Error('error loading contract - interface=' + data.interface));
                    }
                }
                return Promise.reject(new Error('could loading interface - ' + address));
            }, function(error) {
               return Promise.reject(error);
            });
        } else {
            return Promise.reject(new Error('ABI lookup not implemented yet'));
        }
    }
    throw new Error('must specify filename or address');
});


utils.defineReadOnly(ethers, 'getAccount', function() {
    return ethers.signer.getAddress();
});

utils.defineReadOnly(ethers, 'getNetwork', function() {
    return provider.ready().then(function() {
        return ethers.provider.name;
    });
});

utils.defineReadOnly(ethers, 'sendTransaction', function(tx) {
    return ethers.signer.sendTransaction(tx);
});

utils.defineReadOnly(ethers, 'send', function(addressOrName, amountWei) {
    return ethers.signer.sendTransaction({
        to: addressOrName,
        value: amountWei
    });
});

[
  'getBlockNumber',
  'getGasPrice',
  'getBalance',
  'getTransactionCount',
  'getCode',
  'getStorageAt',
  'call',
  'estimateGas',
  'getBlock',
  'getTransaction',
  'getTransactionReceipt',
  'getLogs',
//  'getEthersPrice',
  'resolveName',
  'waitForTransaction'
].forEach(function(method) {
    utils.defineReadOnly(blockchain, method, function() {
        var args = Array.prototype.slice.call(arguments);
        return ethers.provider[method].apply(ethers.provider, args);
    });
});


function Handler(parentUrl) {
    this.parentUrl = parentUrl;

    this.nextMessageId = 1;

    this.pending = [];
    this.inflightCallbacks = {};

    this.window = null;
}

utils.defineReadOnly(Handler.prototype, 'setupWindow', function(window) {
    if (this.window) { throw new Error('already has window'); }

    this.window = window;

    var self = this;
    this.window.addEventListener('message', function(event) {
        //if (event.origin !== parentUrl) { return; }

        var data = event.data;
        if (!data || data.ethers !== 'v\x01\n') { return; }

        try {
            if (data.id) {
                var callback = self.inflightCallbacks[data.id];
                delete self.inflightCallbacks[data.id];

                if (callback) {
                    var results = [null, data.result];
                    if (data.error) {
                        results[0] = new Error(data.error);
                    }

                    callback.apply(self.window, results);
                }

            } else {
                switch (data.action) {
                    case 'accountChanged':
                        if (ethers.onaccount) {
                            ethers.onaccount.call(self.window, data.account);
                        }
                        break;

                    case 'ready':
                        // Already know if we are ready from the connectEthers()
                        if (ethers.onaccount) {
                            ethers.onaccount.call(self.window, data.account);
                        }
                        break;

                    default:
                        throw new Error('Unknown Action: ' + data.action);
                }
            }
        } catch (error) {
            ethersLog(error);
        }
    }, false);

    // Send the 'ready' first
    var readyPayload = this.buildPayload('ready', { title: this.window.document.title })
    this.window.parent.postMessage(readyPayload, this.parentUrl);

    // Flush any pending requests made before the window was set up
    this.pending.forEach(function(operation) {
        this.window.parent.postMessage(JSON.parse(operation), this.parentUrl);
    }, this);

    this.pending = null;
});

utils.defineReadOnly(Handler.prototype, 'buildPayload', function(action, params) {
    return {
        action: action,
        ethers: 'v\x01\n',
        id: this.nextMessageId++,
        params: params
    };
});

utils.defineReadOnly(Handler.prototype, 'sendMessage', function(action, params, callback) {

    var payload = this.buildPayload(action, params);
    if (callback) {
        this.inflightCallbacks[payload.id] = callback;
    }

    if (this.window) {
        this.window.parent.postMessage(payload, this.parentUrl);

    } else {
        // Create an immutable copy for the deferred request
        this.pending.push(JSON.stringify(payload));
    }
});


function EthersSigner(handler) {
    utils.defineReadOnly(this, '_handler', handler);
}

utils.defineReadOnly(EthersSigner.prototype, 'getAddress', function() {
    var self = this;
    return new Promise(function(resolve, reject) {
        self._handler.sendMessage('getAccount', { }, function(error, address) {
            if (error) { return reject(new Error('no account')); }
            resolve(address);
        });
    });
});

utils.defineReadOnly(EthersSigner.prototype, 'getBalance', function(blockTag) {
    var self = this;
    return this.getAddress().then(function(address) {
        return ethers.provider.getBalance(address);
    });
});

utils.defineReadOnly(EthersSigner.prototype, 'sendTransaction', function(tx) {
    var hexTx = {};
    for (var key in tx) {
        if (tx[key] == null) { continue; }
        hexTx[key] = utils.hexlify(tx[key]);
    }

    var self = this;
    return new Promise(function(resolve, reject) {
        self._handler.sendMessage('sendTransaction', { transaction: hexTx }, function(error, tx) {
            if (error) { return reject(error); }
            resolve(tx);
        });
    });
});

utils.defineReadOnly(EthersSigner.prototype, 'signMessage', function(message) {
    var self = this;
    return new Promise(function(resolve, reject) {
        self._handler.sendMessage('signMessage', { message: message }, function(error, signature) {
            if (error) { return reject(error); }
            resolve(signature);
        });
    });
});


function connectEthers(window) {
    if (window.parent === window || window.ethersSkip) {
        return Promise.reject(new Error('no container'));
    }

    return new Promise(function(resolve, reject) {

        var handler = new Handler('*');

        var timer = null;
        handler.sendMessage('getNetwork', {}, function(error, network) {
            if (timer === null) {
                return reject(new Error('Ethers container took too long to reply. Not setting up.'));
            }

            ethersLog('Connected to Ethers Wallet Container: network=' + network);

            clearTimeout(timer);
            timer = null;

            if (network === 'mainnet') {
                network = 'homestead';
            } else if (network === 'testnet') {
                network = 'ropsten';
            }

            if (network.match(/^https?:/)) {
                setProviderProxyTarget(new providers.JsonRpcProvider(network, {
                    name: 'test',
                    chainId: 43
                }));
            } else {
                setProviderProxyTarget(ethersLib.getDefaultProvider(network));
            }
            setSignerProxyTarget(new EthersSigner(handler));

            // @TODO: Make this available as a proxy?
            utils.defineReadOnly(ethers, 'loadApplication', function(url) {
                return new Promise(function(resolve, reject) {
                    handler.sendMessage('loadApplication', { url: url }, function(error) {
                        if (error) { return reject(error); }
                        resolve();
                    });
                });
            });

            resolve(ethers);
        });

        window.document.addEventListener('DOMContentLoaded', function() {
            handler.setupWindow(window);

            // If after 2 seconds, the container has not responded to our 'ready',
            // assume it is not an Ethers container.
            timer = setTimeout(function() {
                timer = null;
                reject(new Error('In a container, but not Ethers. Falling back.'));
            }, 2000);
        });
    });
}

function inject(window) {
    if (window.ethers) { ethers._ethers = window.ethers; }
    // We are going to migrate off of creating the global "ethers" and
    // start calling it "app" in the future to help keep the documentation
    // across the projects and libraries from confusing people.
    window.ethers = ethers;
    window.app = ethers;

    // Keep any existing web3 instance; if we cannot find a container, we will
    // hook it up to our bridge
    var oldWeb3 = window.web3;

    // A bridge that allows a Web3 instance to talk to an Ethers provider and signer
    var providerBridge = new ProviderBridge();

    if (window.Web3) {
        window.web3 = new window.Web3(providerBridge);
    } else {
        window.web3 = { currentProvider: providerBridge };
    }

    connectEthers(window).then(function(ethers) {
        providerBridge.connectEthers(ethers.provider, ethers.signer);
    }).catch(function(error) {
        var network = window.ethersNetwork || 'homestead';

        // MetaMask, Mist or such
        if (oldWeb3 && oldWeb3.currentProvider) {
            ethersLog('Connected Injected Web3: network=' + network);
            providerBridge.connectWeb3(oldWeb3.currentProvider);

            // Expose the Ethers API on injected Web3
            var web3Provider = new providers.Web3Provider(window.web3.currentProvider, network)
            setProviderProxyTarget(web3Provider);
            setSignerProxyTarget(web3Provider.getSigner());

        // No Ethers, MetaMask, Mist or anything else... Create a generic provider (no signer)
        } else {
            ethersLog('Connected Default Provider: network=' + network);
            setProviderProxyTarget(ethersLib.getDefaultProvider(network));

            // No private keys to sign with
            var zeroSigner = new Signer();
            utils.defineReadOnly(zeroSigner, 'getAddress', function() { return Promise.resolve(null); });
            utils.defineReadOnly(zeroSigner, 'getBalance', function() { return Promise.reject(new Error('no signer')); });
            utils.defineReadOnly(zeroSigner, 'sendTransaction', function() { return Promise.reject(new Error('no signer')); });
            utils.defineReadOnly(zeroSigner, 'signMessage', function() { return Promise.reject(new Error('no signer')); });
            setSignerProxyTarget(zeroSigner);

            providerBridge.connectEthers(provider);
        }
    }).then(function() {
        onready();
    });
}

inject(global);

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"ethers":33,"ethers-web3-bridge":31}],2:[function(require,module,exports){
(function (module, exports) {
  'use strict';

  // Utils
  function assert (val, msg) {
    if (!val) throw new Error(msg || 'Assertion failed');
  }

  // Could use `inherits` module, but don't want to move from single file
  // architecture yet.
  function inherits (ctor, superCtor) {
    ctor.super_ = superCtor;
    var TempCtor = function () {};
    TempCtor.prototype = superCtor.prototype;
    ctor.prototype = new TempCtor();
    ctor.prototype.constructor = ctor;
  }

  // BN

  function BN (number, base, endian) {
    if (BN.isBN(number)) {
      return number;
    }

    this.negative = 0;
    this.words = null;
    this.length = 0;

    // Reduction context
    this.red = null;

    if (number !== null) {
      if (base === 'le' || base === 'be') {
        endian = base;
        base = 10;
      }

      this._init(number || 0, base || 10, endian || 'be');
    }
  }
  if (typeof module === 'object') {
    module.exports = BN;
  } else {
    exports.BN = BN;
  }

  BN.BN = BN;
  BN.wordSize = 26;

  var Buffer;
  try {
    Buffer = require('buffer').Buffer;
  } catch (e) {
  }

  BN.isBN = function isBN (num) {
    if (num instanceof BN) {
      return true;
    }

    return num !== null && typeof num === 'object' &&
      num.constructor.wordSize === BN.wordSize && Array.isArray(num.words);
  };

  BN.max = function max (left, right) {
    if (left.cmp(right) > 0) return left;
    return right;
  };

  BN.min = function min (left, right) {
    if (left.cmp(right) < 0) return left;
    return right;
  };

  BN.prototype._init = function init (number, base, endian) {
    if (typeof number === 'number') {
      return this._initNumber(number, base, endian);
    }

    if (typeof number === 'object') {
      return this._initArray(number, base, endian);
    }

    if (base === 'hex') {
      base = 16;
    }
    assert(base === (base | 0) && base >= 2 && base <= 36);

    number = number.toString().replace(/\s+/g, '');
    var start = 0;
    if (number[0] === '-') {
      start++;
    }

    if (base === 16) {
      this._parseHex(number, start);
    } else {
      this._parseBase(number, base, start);
    }

    if (number[0] === '-') {
      this.negative = 1;
    }

    this.strip();

    if (endian !== 'le') return;

    this._initArray(this.toArray(), base, endian);
  };

  BN.prototype._initNumber = function _initNumber (number, base, endian) {
    if (number < 0) {
      this.negative = 1;
      number = -number;
    }
    if (number < 0x4000000) {
      this.words = [ number & 0x3ffffff ];
      this.length = 1;
    } else if (number < 0x10000000000000) {
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff
      ];
      this.length = 2;
    } else {
      assert(number < 0x20000000000000); // 2 ^ 53 (unsafe)
      this.words = [
        number & 0x3ffffff,
        (number / 0x4000000) & 0x3ffffff,
        1
      ];
      this.length = 3;
    }

    if (endian !== 'le') return;

    // Reverse the bytes
    this._initArray(this.toArray(), base, endian);
  };

  BN.prototype._initArray = function _initArray (number, base, endian) {
    // Perhaps a Uint8Array
    assert(typeof number.length === 'number');
    if (number.length <= 0) {
      this.words = [ 0 ];
      this.length = 1;
      return this;
    }

    this.length = Math.ceil(number.length / 3);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    var j, w;
    var off = 0;
    if (endian === 'be') {
      for (i = number.length - 1, j = 0; i >= 0; i -= 3) {
        w = number[i] | (number[i - 1] << 8) | (number[i - 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    } else if (endian === 'le') {
      for (i = 0, j = 0; i < number.length; i += 3) {
        w = number[i] | (number[i + 1] << 8) | (number[i + 2] << 16);
        this.words[j] |= (w << off) & 0x3ffffff;
        this.words[j + 1] = (w >>> (26 - off)) & 0x3ffffff;
        off += 24;
        if (off >= 26) {
          off -= 26;
          j++;
        }
      }
    }
    return this.strip();
  };

  function parseHex (str, start, end) {
    var r = 0;
    var len = Math.min(str.length, end);
    for (var i = start; i < len; i++) {
      var c = str.charCodeAt(i) - 48;

      r <<= 4;

      // 'a' - 'f'
      if (c >= 49 && c <= 54) {
        r |= c - 49 + 0xa;

      // 'A' - 'F'
      } else if (c >= 17 && c <= 22) {
        r |= c - 17 + 0xa;

      // '0' - '9'
      } else {
        r |= c & 0xf;
      }
    }
    return r;
  }

  BN.prototype._parseHex = function _parseHex (number, start) {
    // Create possibly bigger array to ensure that it fits the number
    this.length = Math.ceil((number.length - start) / 6);
    this.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      this.words[i] = 0;
    }

    var j, w;
    // Scan 24-bit chunks and add them to the number
    var off = 0;
    for (i = number.length - 6, j = 0; i >= start; i -= 6) {
      w = parseHex(number, i, i + 6);
      this.words[j] |= (w << off) & 0x3ffffff;
      // NOTE: `0x3fffff` is intentional here, 26bits max shift + 24bit hex limb
      this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
      off += 24;
      if (off >= 26) {
        off -= 26;
        j++;
      }
    }
    if (i + 6 !== start) {
      w = parseHex(number, start, i + 6);
      this.words[j] |= (w << off) & 0x3ffffff;
      this.words[j + 1] |= w >>> (26 - off) & 0x3fffff;
    }
    this.strip();
  };

  function parseBase (str, start, end, mul) {
    var r = 0;
    var len = Math.min(str.length, end);
    for (var i = start; i < len; i++) {
      var c = str.charCodeAt(i) - 48;

      r *= mul;

      // 'a'
      if (c >= 49) {
        r += c - 49 + 0xa;

      // 'A'
      } else if (c >= 17) {
        r += c - 17 + 0xa;

      // '0' - '9'
      } else {
        r += c;
      }
    }
    return r;
  }

  BN.prototype._parseBase = function _parseBase (number, base, start) {
    // Initialize as zero
    this.words = [ 0 ];
    this.length = 1;

    // Find length of limb in base
    for (var limbLen = 0, limbPow = 1; limbPow <= 0x3ffffff; limbPow *= base) {
      limbLen++;
    }
    limbLen--;
    limbPow = (limbPow / base) | 0;

    var total = number.length - start;
    var mod = total % limbLen;
    var end = Math.min(total, total - mod) + start;

    var word = 0;
    for (var i = start; i < end; i += limbLen) {
      word = parseBase(number, i, i + limbLen, base);

      this.imuln(limbPow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }

    if (mod !== 0) {
      var pow = 1;
      word = parseBase(number, i, number.length, base);

      for (i = 0; i < mod; i++) {
        pow *= base;
      }

      this.imuln(pow);
      if (this.words[0] + word < 0x4000000) {
        this.words[0] += word;
      } else {
        this._iaddn(word);
      }
    }
  };

  BN.prototype.copy = function copy (dest) {
    dest.words = new Array(this.length);
    for (var i = 0; i < this.length; i++) {
      dest.words[i] = this.words[i];
    }
    dest.length = this.length;
    dest.negative = this.negative;
    dest.red = this.red;
  };

  BN.prototype.clone = function clone () {
    var r = new BN(null);
    this.copy(r);
    return r;
  };

  BN.prototype._expand = function _expand (size) {
    while (this.length < size) {
      this.words[this.length++] = 0;
    }
    return this;
  };

  // Remove leading `0` from `this`
  BN.prototype.strip = function strip () {
    while (this.length > 1 && this.words[this.length - 1] === 0) {
      this.length--;
    }
    return this._normSign();
  };

  BN.prototype._normSign = function _normSign () {
    // -0 = 0
    if (this.length === 1 && this.words[0] === 0) {
      this.negative = 0;
    }
    return this;
  };

  BN.prototype.inspect = function inspect () {
    return (this.red ? '<BN-R: ' : '<BN: ') + this.toString(16) + '>';
  };

  /*

  var zeros = [];
  var groupSizes = [];
  var groupBases = [];

  var s = '';
  var i = -1;
  while (++i < BN.wordSize) {
    zeros[i] = s;
    s += '0';
  }
  groupSizes[0] = 0;
  groupSizes[1] = 0;
  groupBases[0] = 0;
  groupBases[1] = 0;
  var base = 2 - 1;
  while (++base < 36 + 1) {
    var groupSize = 0;
    var groupBase = 1;
    while (groupBase < (1 << BN.wordSize) / base) {
      groupBase *= base;
      groupSize += 1;
    }
    groupSizes[base] = groupSize;
    groupBases[base] = groupBase;
  }

  */

  var zeros = [
    '',
    '0',
    '00',
    '000',
    '0000',
    '00000',
    '000000',
    '0000000',
    '00000000',
    '000000000',
    '0000000000',
    '00000000000',
    '000000000000',
    '0000000000000',
    '00000000000000',
    '000000000000000',
    '0000000000000000',
    '00000000000000000',
    '000000000000000000',
    '0000000000000000000',
    '00000000000000000000',
    '000000000000000000000',
    '0000000000000000000000',
    '00000000000000000000000',
    '000000000000000000000000',
    '0000000000000000000000000'
  ];

  var groupSizes = [
    0, 0,
    25, 16, 12, 11, 10, 9, 8,
    8, 7, 7, 7, 7, 6, 6,
    6, 6, 6, 6, 6, 5, 5,
    5, 5, 5, 5, 5, 5, 5,
    5, 5, 5, 5, 5, 5, 5
  ];

  var groupBases = [
    0, 0,
    33554432, 43046721, 16777216, 48828125, 60466176, 40353607, 16777216,
    43046721, 10000000, 19487171, 35831808, 62748517, 7529536, 11390625,
    16777216, 24137569, 34012224, 47045881, 64000000, 4084101, 5153632,
    6436343, 7962624, 9765625, 11881376, 14348907, 17210368, 20511149,
    24300000, 28629151, 33554432, 39135393, 45435424, 52521875, 60466176
  ];

  BN.prototype.toString = function toString (base, padding) {
    base = base || 10;
    padding = padding | 0 || 1;

    var out;
    if (base === 16 || base === 'hex') {
      out = '';
      var off = 0;
      var carry = 0;
      for (var i = 0; i < this.length; i++) {
        var w = this.words[i];
        var word = (((w << off) | carry) & 0xffffff).toString(16);
        carry = (w >>> (24 - off)) & 0xffffff;
        if (carry !== 0 || i !== this.length - 1) {
          out = zeros[6 - word.length] + word + out;
        } else {
          out = word + out;
        }
        off += 2;
        if (off >= 26) {
          off -= 26;
          i--;
        }
      }
      if (carry !== 0) {
        out = carry.toString(16) + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    if (base === (base | 0) && base >= 2 && base <= 36) {
      // var groupSize = Math.floor(BN.wordSize * Math.LN2 / Math.log(base));
      var groupSize = groupSizes[base];
      // var groupBase = Math.pow(base, groupSize);
      var groupBase = groupBases[base];
      out = '';
      var c = this.clone();
      c.negative = 0;
      while (!c.isZero()) {
        var r = c.modn(groupBase).toString(base);
        c = c.idivn(groupBase);

        if (!c.isZero()) {
          out = zeros[groupSize - r.length] + r + out;
        } else {
          out = r + out;
        }
      }
      if (this.isZero()) {
        out = '0' + out;
      }
      while (out.length % padding !== 0) {
        out = '0' + out;
      }
      if (this.negative !== 0) {
        out = '-' + out;
      }
      return out;
    }

    assert(false, 'Base should be between 2 and 36');
  };

  BN.prototype.toNumber = function toNumber () {
    var ret = this.words[0];
    if (this.length === 2) {
      ret += this.words[1] * 0x4000000;
    } else if (this.length === 3 && this.words[2] === 0x01) {
      // NOTE: at this stage it is known that the top bit is set
      ret += 0x10000000000000 + (this.words[1] * 0x4000000);
    } else if (this.length > 2) {
      assert(false, 'Number can only safely store up to 53 bits');
    }
    return (this.negative !== 0) ? -ret : ret;
  };

  BN.prototype.toJSON = function toJSON () {
    return this.toString(16);
  };

  BN.prototype.toBuffer = function toBuffer (endian, length) {
    assert(typeof Buffer !== 'undefined');
    return this.toArrayLike(Buffer, endian, length);
  };

  BN.prototype.toArray = function toArray (endian, length) {
    return this.toArrayLike(Array, endian, length);
  };

  BN.prototype.toArrayLike = function toArrayLike (ArrayType, endian, length) {
    var byteLength = this.byteLength();
    var reqLength = length || Math.max(1, byteLength);
    assert(byteLength <= reqLength, 'byte array longer than desired length');
    assert(reqLength > 0, 'Requested array length <= 0');

    this.strip();
    var littleEndian = endian === 'le';
    var res = new ArrayType(reqLength);

    var b, i;
    var q = this.clone();
    if (!littleEndian) {
      // Assume big-endian
      for (i = 0; i < reqLength - byteLength; i++) {
        res[i] = 0;
      }

      for (i = 0; !q.isZero(); i++) {
        b = q.andln(0xff);
        q.iushrn(8);

        res[reqLength - i - 1] = b;
      }
    } else {
      for (i = 0; !q.isZero(); i++) {
        b = q.andln(0xff);
        q.iushrn(8);

        res[i] = b;
      }

      for (; i < reqLength; i++) {
        res[i] = 0;
      }
    }

    return res;
  };

  if (Math.clz32) {
    BN.prototype._countBits = function _countBits (w) {
      return 32 - Math.clz32(w);
    };
  } else {
    BN.prototype._countBits = function _countBits (w) {
      var t = w;
      var r = 0;
      if (t >= 0x1000) {
        r += 13;
        t >>>= 13;
      }
      if (t >= 0x40) {
        r += 7;
        t >>>= 7;
      }
      if (t >= 0x8) {
        r += 4;
        t >>>= 4;
      }
      if (t >= 0x02) {
        r += 2;
        t >>>= 2;
      }
      return r + t;
    };
  }

  BN.prototype._zeroBits = function _zeroBits (w) {
    // Short-cut
    if (w === 0) return 26;

    var t = w;
    var r = 0;
    if ((t & 0x1fff) === 0) {
      r += 13;
      t >>>= 13;
    }
    if ((t & 0x7f) === 0) {
      r += 7;
      t >>>= 7;
    }
    if ((t & 0xf) === 0) {
      r += 4;
      t >>>= 4;
    }
    if ((t & 0x3) === 0) {
      r += 2;
      t >>>= 2;
    }
    if ((t & 0x1) === 0) {
      r++;
    }
    return r;
  };

  // Return number of used bits in a BN
  BN.prototype.bitLength = function bitLength () {
    var w = this.words[this.length - 1];
    var hi = this._countBits(w);
    return (this.length - 1) * 26 + hi;
  };

  function toBitArray (num) {
    var w = new Array(num.bitLength());

    for (var bit = 0; bit < w.length; bit++) {
      var off = (bit / 26) | 0;
      var wbit = bit % 26;

      w[bit] = (num.words[off] & (1 << wbit)) >>> wbit;
    }

    return w;
  }

  // Number of trailing zero bits
  BN.prototype.zeroBits = function zeroBits () {
    if (this.isZero()) return 0;

    var r = 0;
    for (var i = 0; i < this.length; i++) {
      var b = this._zeroBits(this.words[i]);
      r += b;
      if (b !== 26) break;
    }
    return r;
  };

  BN.prototype.byteLength = function byteLength () {
    return Math.ceil(this.bitLength() / 8);
  };

  BN.prototype.toTwos = function toTwos (width) {
    if (this.negative !== 0) {
      return this.abs().inotn(width).iaddn(1);
    }
    return this.clone();
  };

  BN.prototype.fromTwos = function fromTwos (width) {
    if (this.testn(width - 1)) {
      return this.notn(width).iaddn(1).ineg();
    }
    return this.clone();
  };

  BN.prototype.isNeg = function isNeg () {
    return this.negative !== 0;
  };

  // Return negative clone of `this`
  BN.prototype.neg = function neg () {
    return this.clone().ineg();
  };

  BN.prototype.ineg = function ineg () {
    if (!this.isZero()) {
      this.negative ^= 1;
    }

    return this;
  };

  // Or `num` with `this` in-place
  BN.prototype.iuor = function iuor (num) {
    while (this.length < num.length) {
      this.words[this.length++] = 0;
    }

    for (var i = 0; i < num.length; i++) {
      this.words[i] = this.words[i] | num.words[i];
    }

    return this.strip();
  };

  BN.prototype.ior = function ior (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuor(num);
  };

  // Or `num` with `this`
  BN.prototype.or = function or (num) {
    if (this.length > num.length) return this.clone().ior(num);
    return num.clone().ior(this);
  };

  BN.prototype.uor = function uor (num) {
    if (this.length > num.length) return this.clone().iuor(num);
    return num.clone().iuor(this);
  };

  // And `num` with `this` in-place
  BN.prototype.iuand = function iuand (num) {
    // b = min-length(num, this)
    var b;
    if (this.length > num.length) {
      b = num;
    } else {
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = this.words[i] & num.words[i];
    }

    this.length = b.length;

    return this.strip();
  };

  BN.prototype.iand = function iand (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuand(num);
  };

  // And `num` with `this`
  BN.prototype.and = function and (num) {
    if (this.length > num.length) return this.clone().iand(num);
    return num.clone().iand(this);
  };

  BN.prototype.uand = function uand (num) {
    if (this.length > num.length) return this.clone().iuand(num);
    return num.clone().iuand(this);
  };

  // Xor `num` with `this` in-place
  BN.prototype.iuxor = function iuxor (num) {
    // a.length > b.length
    var a;
    var b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    for (var i = 0; i < b.length; i++) {
      this.words[i] = a.words[i] ^ b.words[i];
    }

    if (this !== a) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = a.length;

    return this.strip();
  };

  BN.prototype.ixor = function ixor (num) {
    assert((this.negative | num.negative) === 0);
    return this.iuxor(num);
  };

  // Xor `num` with `this`
  BN.prototype.xor = function xor (num) {
    if (this.length > num.length) return this.clone().ixor(num);
    return num.clone().ixor(this);
  };

  BN.prototype.uxor = function uxor (num) {
    if (this.length > num.length) return this.clone().iuxor(num);
    return num.clone().iuxor(this);
  };

  // Not ``this`` with ``width`` bitwidth
  BN.prototype.inotn = function inotn (width) {
    assert(typeof width === 'number' && width >= 0);

    var bytesNeeded = Math.ceil(width / 26) | 0;
    var bitsLeft = width % 26;

    // Extend the buffer with leading zeroes
    this._expand(bytesNeeded);

    if (bitsLeft > 0) {
      bytesNeeded--;
    }

    // Handle complete words
    for (var i = 0; i < bytesNeeded; i++) {
      this.words[i] = ~this.words[i] & 0x3ffffff;
    }

    // Handle the residue
    if (bitsLeft > 0) {
      this.words[i] = ~this.words[i] & (0x3ffffff >> (26 - bitsLeft));
    }

    // And remove leading zeroes
    return this.strip();
  };

  BN.prototype.notn = function notn (width) {
    return this.clone().inotn(width);
  };

  // Set `bit` of `this`
  BN.prototype.setn = function setn (bit, val) {
    assert(typeof bit === 'number' && bit >= 0);

    var off = (bit / 26) | 0;
    var wbit = bit % 26;

    this._expand(off + 1);

    if (val) {
      this.words[off] = this.words[off] | (1 << wbit);
    } else {
      this.words[off] = this.words[off] & ~(1 << wbit);
    }

    return this.strip();
  };

  // Add `num` to `this` in-place
  BN.prototype.iadd = function iadd (num) {
    var r;

    // negative + positive
    if (this.negative !== 0 && num.negative === 0) {
      this.negative = 0;
      r = this.isub(num);
      this.negative ^= 1;
      return this._normSign();

    // positive + negative
    } else if (this.negative === 0 && num.negative !== 0) {
      num.negative = 0;
      r = this.isub(num);
      num.negative = 1;
      return r._normSign();
    }

    // a.length > b.length
    var a, b;
    if (this.length > num.length) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) + (b.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      this.words[i] = r & 0x3ffffff;
      carry = r >>> 26;
    }

    this.length = a.length;
    if (carry !== 0) {
      this.words[this.length] = carry;
      this.length++;
    // Copy the rest of the words
    } else if (a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    return this;
  };

  // Add `num` to `this`
  BN.prototype.add = function add (num) {
    var res;
    if (num.negative !== 0 && this.negative === 0) {
      num.negative = 0;
      res = this.sub(num);
      num.negative ^= 1;
      return res;
    } else if (num.negative === 0 && this.negative !== 0) {
      this.negative = 0;
      res = num.sub(this);
      this.negative = 1;
      return res;
    }

    if (this.length > num.length) return this.clone().iadd(num);

    return num.clone().iadd(this);
  };

  // Subtract `num` from `this` in-place
  BN.prototype.isub = function isub (num) {
    // this - (-num) = this + num
    if (num.negative !== 0) {
      num.negative = 0;
      var r = this.iadd(num);
      num.negative = 1;
      return r._normSign();

    // -this - num = -(this + num)
    } else if (this.negative !== 0) {
      this.negative = 0;
      this.iadd(num);
      this.negative = 1;
      return this._normSign();
    }

    // At this point both numbers are positive
    var cmp = this.cmp(num);

    // Optimization - zeroify
    if (cmp === 0) {
      this.negative = 0;
      this.length = 1;
      this.words[0] = 0;
      return this;
    }

    // a > b
    var a, b;
    if (cmp > 0) {
      a = this;
      b = num;
    } else {
      a = num;
      b = this;
    }

    var carry = 0;
    for (var i = 0; i < b.length; i++) {
      r = (a.words[i] | 0) - (b.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }
    for (; carry !== 0 && i < a.length; i++) {
      r = (a.words[i] | 0) + carry;
      carry = r >> 26;
      this.words[i] = r & 0x3ffffff;
    }

    // Copy rest of the words
    if (carry === 0 && i < a.length && a !== this) {
      for (; i < a.length; i++) {
        this.words[i] = a.words[i];
      }
    }

    this.length = Math.max(this.length, i);

    if (a !== this) {
      this.negative = 1;
    }

    return this.strip();
  };

  // Subtract `num` from `this`
  BN.prototype.sub = function sub (num) {
    return this.clone().isub(num);
  };

  function smallMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    var len = (self.length + num.length) | 0;
    out.length = len;
    len = (len - 1) | 0;

    // Peel one iteration (compiler can't do it, because of code complexity)
    var a = self.words[0] | 0;
    var b = num.words[0] | 0;
    var r = a * b;

    var lo = r & 0x3ffffff;
    var carry = (r / 0x4000000) | 0;
    out.words[0] = lo;

    for (var k = 1; k < len; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = carry >>> 26;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = (k - j) | 0;
        a = self.words[i] | 0;
        b = num.words[j] | 0;
        r = a * b + rword;
        ncarry += (r / 0x4000000) | 0;
        rword = r & 0x3ffffff;
      }
      out.words[k] = rword | 0;
      carry = ncarry | 0;
    }
    if (carry !== 0) {
      out.words[k] = carry | 0;
    } else {
      out.length--;
    }

    return out.strip();
  }

  // TODO(indutny): it may be reasonable to omit it for users who don't need
  // to work with 256-bit numbers, otherwise it gives 20% improvement for 256-bit
  // multiplication (like elliptic secp256k1).
  var comb10MulTo = function comb10MulTo (self, num, out) {
    var a = self.words;
    var b = num.words;
    var o = out.words;
    var c = 0;
    var lo;
    var mid;
    var hi;
    var a0 = a[0] | 0;
    var al0 = a0 & 0x1fff;
    var ah0 = a0 >>> 13;
    var a1 = a[1] | 0;
    var al1 = a1 & 0x1fff;
    var ah1 = a1 >>> 13;
    var a2 = a[2] | 0;
    var al2 = a2 & 0x1fff;
    var ah2 = a2 >>> 13;
    var a3 = a[3] | 0;
    var al3 = a3 & 0x1fff;
    var ah3 = a3 >>> 13;
    var a4 = a[4] | 0;
    var al4 = a4 & 0x1fff;
    var ah4 = a4 >>> 13;
    var a5 = a[5] | 0;
    var al5 = a5 & 0x1fff;
    var ah5 = a5 >>> 13;
    var a6 = a[6] | 0;
    var al6 = a6 & 0x1fff;
    var ah6 = a6 >>> 13;
    var a7 = a[7] | 0;
    var al7 = a7 & 0x1fff;
    var ah7 = a7 >>> 13;
    var a8 = a[8] | 0;
    var al8 = a8 & 0x1fff;
    var ah8 = a8 >>> 13;
    var a9 = a[9] | 0;
    var al9 = a9 & 0x1fff;
    var ah9 = a9 >>> 13;
    var b0 = b[0] | 0;
    var bl0 = b0 & 0x1fff;
    var bh0 = b0 >>> 13;
    var b1 = b[1] | 0;
    var bl1 = b1 & 0x1fff;
    var bh1 = b1 >>> 13;
    var b2 = b[2] | 0;
    var bl2 = b2 & 0x1fff;
    var bh2 = b2 >>> 13;
    var b3 = b[3] | 0;
    var bl3 = b3 & 0x1fff;
    var bh3 = b3 >>> 13;
    var b4 = b[4] | 0;
    var bl4 = b4 & 0x1fff;
    var bh4 = b4 >>> 13;
    var b5 = b[5] | 0;
    var bl5 = b5 & 0x1fff;
    var bh5 = b5 >>> 13;
    var b6 = b[6] | 0;
    var bl6 = b6 & 0x1fff;
    var bh6 = b6 >>> 13;
    var b7 = b[7] | 0;
    var bl7 = b7 & 0x1fff;
    var bh7 = b7 >>> 13;
    var b8 = b[8] | 0;
    var bl8 = b8 & 0x1fff;
    var bh8 = b8 >>> 13;
    var b9 = b[9] | 0;
    var bl9 = b9 & 0x1fff;
    var bh9 = b9 >>> 13;

    out.negative = self.negative ^ num.negative;
    out.length = 19;
    /* k = 0 */
    lo = Math.imul(al0, bl0);
    mid = Math.imul(al0, bh0);
    mid = (mid + Math.imul(ah0, bl0)) | 0;
    hi = Math.imul(ah0, bh0);
    var w0 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w0 >>> 26)) | 0;
    w0 &= 0x3ffffff;
    /* k = 1 */
    lo = Math.imul(al1, bl0);
    mid = Math.imul(al1, bh0);
    mid = (mid + Math.imul(ah1, bl0)) | 0;
    hi = Math.imul(ah1, bh0);
    lo = (lo + Math.imul(al0, bl1)) | 0;
    mid = (mid + Math.imul(al0, bh1)) | 0;
    mid = (mid + Math.imul(ah0, bl1)) | 0;
    hi = (hi + Math.imul(ah0, bh1)) | 0;
    var w1 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w1 >>> 26)) | 0;
    w1 &= 0x3ffffff;
    /* k = 2 */
    lo = Math.imul(al2, bl0);
    mid = Math.imul(al2, bh0);
    mid = (mid + Math.imul(ah2, bl0)) | 0;
    hi = Math.imul(ah2, bh0);
    lo = (lo + Math.imul(al1, bl1)) | 0;
    mid = (mid + Math.imul(al1, bh1)) | 0;
    mid = (mid + Math.imul(ah1, bl1)) | 0;
    hi = (hi + Math.imul(ah1, bh1)) | 0;
    lo = (lo + Math.imul(al0, bl2)) | 0;
    mid = (mid + Math.imul(al0, bh2)) | 0;
    mid = (mid + Math.imul(ah0, bl2)) | 0;
    hi = (hi + Math.imul(ah0, bh2)) | 0;
    var w2 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w2 >>> 26)) | 0;
    w2 &= 0x3ffffff;
    /* k = 3 */
    lo = Math.imul(al3, bl0);
    mid = Math.imul(al3, bh0);
    mid = (mid + Math.imul(ah3, bl0)) | 0;
    hi = Math.imul(ah3, bh0);
    lo = (lo + Math.imul(al2, bl1)) | 0;
    mid = (mid + Math.imul(al2, bh1)) | 0;
    mid = (mid + Math.imul(ah2, bl1)) | 0;
    hi = (hi + Math.imul(ah2, bh1)) | 0;
    lo = (lo + Math.imul(al1, bl2)) | 0;
    mid = (mid + Math.imul(al1, bh2)) | 0;
    mid = (mid + Math.imul(ah1, bl2)) | 0;
    hi = (hi + Math.imul(ah1, bh2)) | 0;
    lo = (lo + Math.imul(al0, bl3)) | 0;
    mid = (mid + Math.imul(al0, bh3)) | 0;
    mid = (mid + Math.imul(ah0, bl3)) | 0;
    hi = (hi + Math.imul(ah0, bh3)) | 0;
    var w3 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w3 >>> 26)) | 0;
    w3 &= 0x3ffffff;
    /* k = 4 */
    lo = Math.imul(al4, bl0);
    mid = Math.imul(al4, bh0);
    mid = (mid + Math.imul(ah4, bl0)) | 0;
    hi = Math.imul(ah4, bh0);
    lo = (lo + Math.imul(al3, bl1)) | 0;
    mid = (mid + Math.imul(al3, bh1)) | 0;
    mid = (mid + Math.imul(ah3, bl1)) | 0;
    hi = (hi + Math.imul(ah3, bh1)) | 0;
    lo = (lo + Math.imul(al2, bl2)) | 0;
    mid = (mid + Math.imul(al2, bh2)) | 0;
    mid = (mid + Math.imul(ah2, bl2)) | 0;
    hi = (hi + Math.imul(ah2, bh2)) | 0;
    lo = (lo + Math.imul(al1, bl3)) | 0;
    mid = (mid + Math.imul(al1, bh3)) | 0;
    mid = (mid + Math.imul(ah1, bl3)) | 0;
    hi = (hi + Math.imul(ah1, bh3)) | 0;
    lo = (lo + Math.imul(al0, bl4)) | 0;
    mid = (mid + Math.imul(al0, bh4)) | 0;
    mid = (mid + Math.imul(ah0, bl4)) | 0;
    hi = (hi + Math.imul(ah0, bh4)) | 0;
    var w4 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w4 >>> 26)) | 0;
    w4 &= 0x3ffffff;
    /* k = 5 */
    lo = Math.imul(al5, bl0);
    mid = Math.imul(al5, bh0);
    mid = (mid + Math.imul(ah5, bl0)) | 0;
    hi = Math.imul(ah5, bh0);
    lo = (lo + Math.imul(al4, bl1)) | 0;
    mid = (mid + Math.imul(al4, bh1)) | 0;
    mid = (mid + Math.imul(ah4, bl1)) | 0;
    hi = (hi + Math.imul(ah4, bh1)) | 0;
    lo = (lo + Math.imul(al3, bl2)) | 0;
    mid = (mid + Math.imul(al3, bh2)) | 0;
    mid = (mid + Math.imul(ah3, bl2)) | 0;
    hi = (hi + Math.imul(ah3, bh2)) | 0;
    lo = (lo + Math.imul(al2, bl3)) | 0;
    mid = (mid + Math.imul(al2, bh3)) | 0;
    mid = (mid + Math.imul(ah2, bl3)) | 0;
    hi = (hi + Math.imul(ah2, bh3)) | 0;
    lo = (lo + Math.imul(al1, bl4)) | 0;
    mid = (mid + Math.imul(al1, bh4)) | 0;
    mid = (mid + Math.imul(ah1, bl4)) | 0;
    hi = (hi + Math.imul(ah1, bh4)) | 0;
    lo = (lo + Math.imul(al0, bl5)) | 0;
    mid = (mid + Math.imul(al0, bh5)) | 0;
    mid = (mid + Math.imul(ah0, bl5)) | 0;
    hi = (hi + Math.imul(ah0, bh5)) | 0;
    var w5 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w5 >>> 26)) | 0;
    w5 &= 0x3ffffff;
    /* k = 6 */
    lo = Math.imul(al6, bl0);
    mid = Math.imul(al6, bh0);
    mid = (mid + Math.imul(ah6, bl0)) | 0;
    hi = Math.imul(ah6, bh0);
    lo = (lo + Math.imul(al5, bl1)) | 0;
    mid = (mid + Math.imul(al5, bh1)) | 0;
    mid = (mid + Math.imul(ah5, bl1)) | 0;
    hi = (hi + Math.imul(ah5, bh1)) | 0;
    lo = (lo + Math.imul(al4, bl2)) | 0;
    mid = (mid + Math.imul(al4, bh2)) | 0;
    mid = (mid + Math.imul(ah4, bl2)) | 0;
    hi = (hi + Math.imul(ah4, bh2)) | 0;
    lo = (lo + Math.imul(al3, bl3)) | 0;
    mid = (mid + Math.imul(al3, bh3)) | 0;
    mid = (mid + Math.imul(ah3, bl3)) | 0;
    hi = (hi + Math.imul(ah3, bh3)) | 0;
    lo = (lo + Math.imul(al2, bl4)) | 0;
    mid = (mid + Math.imul(al2, bh4)) | 0;
    mid = (mid + Math.imul(ah2, bl4)) | 0;
    hi = (hi + Math.imul(ah2, bh4)) | 0;
    lo = (lo + Math.imul(al1, bl5)) | 0;
    mid = (mid + Math.imul(al1, bh5)) | 0;
    mid = (mid + Math.imul(ah1, bl5)) | 0;
    hi = (hi + Math.imul(ah1, bh5)) | 0;
    lo = (lo + Math.imul(al0, bl6)) | 0;
    mid = (mid + Math.imul(al0, bh6)) | 0;
    mid = (mid + Math.imul(ah0, bl6)) | 0;
    hi = (hi + Math.imul(ah0, bh6)) | 0;
    var w6 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w6 >>> 26)) | 0;
    w6 &= 0x3ffffff;
    /* k = 7 */
    lo = Math.imul(al7, bl0);
    mid = Math.imul(al7, bh0);
    mid = (mid + Math.imul(ah7, bl0)) | 0;
    hi = Math.imul(ah7, bh0);
    lo = (lo + Math.imul(al6, bl1)) | 0;
    mid = (mid + Math.imul(al6, bh1)) | 0;
    mid = (mid + Math.imul(ah6, bl1)) | 0;
    hi = (hi + Math.imul(ah6, bh1)) | 0;
    lo = (lo + Math.imul(al5, bl2)) | 0;
    mid = (mid + Math.imul(al5, bh2)) | 0;
    mid = (mid + Math.imul(ah5, bl2)) | 0;
    hi = (hi + Math.imul(ah5, bh2)) | 0;
    lo = (lo + Math.imul(al4, bl3)) | 0;
    mid = (mid + Math.imul(al4, bh3)) | 0;
    mid = (mid + Math.imul(ah4, bl3)) | 0;
    hi = (hi + Math.imul(ah4, bh3)) | 0;
    lo = (lo + Math.imul(al3, bl4)) | 0;
    mid = (mid + Math.imul(al3, bh4)) | 0;
    mid = (mid + Math.imul(ah3, bl4)) | 0;
    hi = (hi + Math.imul(ah3, bh4)) | 0;
    lo = (lo + Math.imul(al2, bl5)) | 0;
    mid = (mid + Math.imul(al2, bh5)) | 0;
    mid = (mid + Math.imul(ah2, bl5)) | 0;
    hi = (hi + Math.imul(ah2, bh5)) | 0;
    lo = (lo + Math.imul(al1, bl6)) | 0;
    mid = (mid + Math.imul(al1, bh6)) | 0;
    mid = (mid + Math.imul(ah1, bl6)) | 0;
    hi = (hi + Math.imul(ah1, bh6)) | 0;
    lo = (lo + Math.imul(al0, bl7)) | 0;
    mid = (mid + Math.imul(al0, bh7)) | 0;
    mid = (mid + Math.imul(ah0, bl7)) | 0;
    hi = (hi + Math.imul(ah0, bh7)) | 0;
    var w7 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w7 >>> 26)) | 0;
    w7 &= 0x3ffffff;
    /* k = 8 */
    lo = Math.imul(al8, bl0);
    mid = Math.imul(al8, bh0);
    mid = (mid + Math.imul(ah8, bl0)) | 0;
    hi = Math.imul(ah8, bh0);
    lo = (lo + Math.imul(al7, bl1)) | 0;
    mid = (mid + Math.imul(al7, bh1)) | 0;
    mid = (mid + Math.imul(ah7, bl1)) | 0;
    hi = (hi + Math.imul(ah7, bh1)) | 0;
    lo = (lo + Math.imul(al6, bl2)) | 0;
    mid = (mid + Math.imul(al6, bh2)) | 0;
    mid = (mid + Math.imul(ah6, bl2)) | 0;
    hi = (hi + Math.imul(ah6, bh2)) | 0;
    lo = (lo + Math.imul(al5, bl3)) | 0;
    mid = (mid + Math.imul(al5, bh3)) | 0;
    mid = (mid + Math.imul(ah5, bl3)) | 0;
    hi = (hi + Math.imul(ah5, bh3)) | 0;
    lo = (lo + Math.imul(al4, bl4)) | 0;
    mid = (mid + Math.imul(al4, bh4)) | 0;
    mid = (mid + Math.imul(ah4, bl4)) | 0;
    hi = (hi + Math.imul(ah4, bh4)) | 0;
    lo = (lo + Math.imul(al3, bl5)) | 0;
    mid = (mid + Math.imul(al3, bh5)) | 0;
    mid = (mid + Math.imul(ah3, bl5)) | 0;
    hi = (hi + Math.imul(ah3, bh5)) | 0;
    lo = (lo + Math.imul(al2, bl6)) | 0;
    mid = (mid + Math.imul(al2, bh6)) | 0;
    mid = (mid + Math.imul(ah2, bl6)) | 0;
    hi = (hi + Math.imul(ah2, bh6)) | 0;
    lo = (lo + Math.imul(al1, bl7)) | 0;
    mid = (mid + Math.imul(al1, bh7)) | 0;
    mid = (mid + Math.imul(ah1, bl7)) | 0;
    hi = (hi + Math.imul(ah1, bh7)) | 0;
    lo = (lo + Math.imul(al0, bl8)) | 0;
    mid = (mid + Math.imul(al0, bh8)) | 0;
    mid = (mid + Math.imul(ah0, bl8)) | 0;
    hi = (hi + Math.imul(ah0, bh8)) | 0;
    var w8 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w8 >>> 26)) | 0;
    w8 &= 0x3ffffff;
    /* k = 9 */
    lo = Math.imul(al9, bl0);
    mid = Math.imul(al9, bh0);
    mid = (mid + Math.imul(ah9, bl0)) | 0;
    hi = Math.imul(ah9, bh0);
    lo = (lo + Math.imul(al8, bl1)) | 0;
    mid = (mid + Math.imul(al8, bh1)) | 0;
    mid = (mid + Math.imul(ah8, bl1)) | 0;
    hi = (hi + Math.imul(ah8, bh1)) | 0;
    lo = (lo + Math.imul(al7, bl2)) | 0;
    mid = (mid + Math.imul(al7, bh2)) | 0;
    mid = (mid + Math.imul(ah7, bl2)) | 0;
    hi = (hi + Math.imul(ah7, bh2)) | 0;
    lo = (lo + Math.imul(al6, bl3)) | 0;
    mid = (mid + Math.imul(al6, bh3)) | 0;
    mid = (mid + Math.imul(ah6, bl3)) | 0;
    hi = (hi + Math.imul(ah6, bh3)) | 0;
    lo = (lo + Math.imul(al5, bl4)) | 0;
    mid = (mid + Math.imul(al5, bh4)) | 0;
    mid = (mid + Math.imul(ah5, bl4)) | 0;
    hi = (hi + Math.imul(ah5, bh4)) | 0;
    lo = (lo + Math.imul(al4, bl5)) | 0;
    mid = (mid + Math.imul(al4, bh5)) | 0;
    mid = (mid + Math.imul(ah4, bl5)) | 0;
    hi = (hi + Math.imul(ah4, bh5)) | 0;
    lo = (lo + Math.imul(al3, bl6)) | 0;
    mid = (mid + Math.imul(al3, bh6)) | 0;
    mid = (mid + Math.imul(ah3, bl6)) | 0;
    hi = (hi + Math.imul(ah3, bh6)) | 0;
    lo = (lo + Math.imul(al2, bl7)) | 0;
    mid = (mid + Math.imul(al2, bh7)) | 0;
    mid = (mid + Math.imul(ah2, bl7)) | 0;
    hi = (hi + Math.imul(ah2, bh7)) | 0;
    lo = (lo + Math.imul(al1, bl8)) | 0;
    mid = (mid + Math.imul(al1, bh8)) | 0;
    mid = (mid + Math.imul(ah1, bl8)) | 0;
    hi = (hi + Math.imul(ah1, bh8)) | 0;
    lo = (lo + Math.imul(al0, bl9)) | 0;
    mid = (mid + Math.imul(al0, bh9)) | 0;
    mid = (mid + Math.imul(ah0, bl9)) | 0;
    hi = (hi + Math.imul(ah0, bh9)) | 0;
    var w9 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w9 >>> 26)) | 0;
    w9 &= 0x3ffffff;
    /* k = 10 */
    lo = Math.imul(al9, bl1);
    mid = Math.imul(al9, bh1);
    mid = (mid + Math.imul(ah9, bl1)) | 0;
    hi = Math.imul(ah9, bh1);
    lo = (lo + Math.imul(al8, bl2)) | 0;
    mid = (mid + Math.imul(al8, bh2)) | 0;
    mid = (mid + Math.imul(ah8, bl2)) | 0;
    hi = (hi + Math.imul(ah8, bh2)) | 0;
    lo = (lo + Math.imul(al7, bl3)) | 0;
    mid = (mid + Math.imul(al7, bh3)) | 0;
    mid = (mid + Math.imul(ah7, bl3)) | 0;
    hi = (hi + Math.imul(ah7, bh3)) | 0;
    lo = (lo + Math.imul(al6, bl4)) | 0;
    mid = (mid + Math.imul(al6, bh4)) | 0;
    mid = (mid + Math.imul(ah6, bl4)) | 0;
    hi = (hi + Math.imul(ah6, bh4)) | 0;
    lo = (lo + Math.imul(al5, bl5)) | 0;
    mid = (mid + Math.imul(al5, bh5)) | 0;
    mid = (mid + Math.imul(ah5, bl5)) | 0;
    hi = (hi + Math.imul(ah5, bh5)) | 0;
    lo = (lo + Math.imul(al4, bl6)) | 0;
    mid = (mid + Math.imul(al4, bh6)) | 0;
    mid = (mid + Math.imul(ah4, bl6)) | 0;
    hi = (hi + Math.imul(ah4, bh6)) | 0;
    lo = (lo + Math.imul(al3, bl7)) | 0;
    mid = (mid + Math.imul(al3, bh7)) | 0;
    mid = (mid + Math.imul(ah3, bl7)) | 0;
    hi = (hi + Math.imul(ah3, bh7)) | 0;
    lo = (lo + Math.imul(al2, bl8)) | 0;
    mid = (mid + Math.imul(al2, bh8)) | 0;
    mid = (mid + Math.imul(ah2, bl8)) | 0;
    hi = (hi + Math.imul(ah2, bh8)) | 0;
    lo = (lo + Math.imul(al1, bl9)) | 0;
    mid = (mid + Math.imul(al1, bh9)) | 0;
    mid = (mid + Math.imul(ah1, bl9)) | 0;
    hi = (hi + Math.imul(ah1, bh9)) | 0;
    var w10 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w10 >>> 26)) | 0;
    w10 &= 0x3ffffff;
    /* k = 11 */
    lo = Math.imul(al9, bl2);
    mid = Math.imul(al9, bh2);
    mid = (mid + Math.imul(ah9, bl2)) | 0;
    hi = Math.imul(ah9, bh2);
    lo = (lo + Math.imul(al8, bl3)) | 0;
    mid = (mid + Math.imul(al8, bh3)) | 0;
    mid = (mid + Math.imul(ah8, bl3)) | 0;
    hi = (hi + Math.imul(ah8, bh3)) | 0;
    lo = (lo + Math.imul(al7, bl4)) | 0;
    mid = (mid + Math.imul(al7, bh4)) | 0;
    mid = (mid + Math.imul(ah7, bl4)) | 0;
    hi = (hi + Math.imul(ah7, bh4)) | 0;
    lo = (lo + Math.imul(al6, bl5)) | 0;
    mid = (mid + Math.imul(al6, bh5)) | 0;
    mid = (mid + Math.imul(ah6, bl5)) | 0;
    hi = (hi + Math.imul(ah6, bh5)) | 0;
    lo = (lo + Math.imul(al5, bl6)) | 0;
    mid = (mid + Math.imul(al5, bh6)) | 0;
    mid = (mid + Math.imul(ah5, bl6)) | 0;
    hi = (hi + Math.imul(ah5, bh6)) | 0;
    lo = (lo + Math.imul(al4, bl7)) | 0;
    mid = (mid + Math.imul(al4, bh7)) | 0;
    mid = (mid + Math.imul(ah4, bl7)) | 0;
    hi = (hi + Math.imul(ah4, bh7)) | 0;
    lo = (lo + Math.imul(al3, bl8)) | 0;
    mid = (mid + Math.imul(al3, bh8)) | 0;
    mid = (mid + Math.imul(ah3, bl8)) | 0;
    hi = (hi + Math.imul(ah3, bh8)) | 0;
    lo = (lo + Math.imul(al2, bl9)) | 0;
    mid = (mid + Math.imul(al2, bh9)) | 0;
    mid = (mid + Math.imul(ah2, bl9)) | 0;
    hi = (hi + Math.imul(ah2, bh9)) | 0;
    var w11 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w11 >>> 26)) | 0;
    w11 &= 0x3ffffff;
    /* k = 12 */
    lo = Math.imul(al9, bl3);
    mid = Math.imul(al9, bh3);
    mid = (mid + Math.imul(ah9, bl3)) | 0;
    hi = Math.imul(ah9, bh3);
    lo = (lo + Math.imul(al8, bl4)) | 0;
    mid = (mid + Math.imul(al8, bh4)) | 0;
    mid = (mid + Math.imul(ah8, bl4)) | 0;
    hi = (hi + Math.imul(ah8, bh4)) | 0;
    lo = (lo + Math.imul(al7, bl5)) | 0;
    mid = (mid + Math.imul(al7, bh5)) | 0;
    mid = (mid + Math.imul(ah7, bl5)) | 0;
    hi = (hi + Math.imul(ah7, bh5)) | 0;
    lo = (lo + Math.imul(al6, bl6)) | 0;
    mid = (mid + Math.imul(al6, bh6)) | 0;
    mid = (mid + Math.imul(ah6, bl6)) | 0;
    hi = (hi + Math.imul(ah6, bh6)) | 0;
    lo = (lo + Math.imul(al5, bl7)) | 0;
    mid = (mid + Math.imul(al5, bh7)) | 0;
    mid = (mid + Math.imul(ah5, bl7)) | 0;
    hi = (hi + Math.imul(ah5, bh7)) | 0;
    lo = (lo + Math.imul(al4, bl8)) | 0;
    mid = (mid + Math.imul(al4, bh8)) | 0;
    mid = (mid + Math.imul(ah4, bl8)) | 0;
    hi = (hi + Math.imul(ah4, bh8)) | 0;
    lo = (lo + Math.imul(al3, bl9)) | 0;
    mid = (mid + Math.imul(al3, bh9)) | 0;
    mid = (mid + Math.imul(ah3, bl9)) | 0;
    hi = (hi + Math.imul(ah3, bh9)) | 0;
    var w12 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w12 >>> 26)) | 0;
    w12 &= 0x3ffffff;
    /* k = 13 */
    lo = Math.imul(al9, bl4);
    mid = Math.imul(al9, bh4);
    mid = (mid + Math.imul(ah9, bl4)) | 0;
    hi = Math.imul(ah9, bh4);
    lo = (lo + Math.imul(al8, bl5)) | 0;
    mid = (mid + Math.imul(al8, bh5)) | 0;
    mid = (mid + Math.imul(ah8, bl5)) | 0;
    hi = (hi + Math.imul(ah8, bh5)) | 0;
    lo = (lo + Math.imul(al7, bl6)) | 0;
    mid = (mid + Math.imul(al7, bh6)) | 0;
    mid = (mid + Math.imul(ah7, bl6)) | 0;
    hi = (hi + Math.imul(ah7, bh6)) | 0;
    lo = (lo + Math.imul(al6, bl7)) | 0;
    mid = (mid + Math.imul(al6, bh7)) | 0;
    mid = (mid + Math.imul(ah6, bl7)) | 0;
    hi = (hi + Math.imul(ah6, bh7)) | 0;
    lo = (lo + Math.imul(al5, bl8)) | 0;
    mid = (mid + Math.imul(al5, bh8)) | 0;
    mid = (mid + Math.imul(ah5, bl8)) | 0;
    hi = (hi + Math.imul(ah5, bh8)) | 0;
    lo = (lo + Math.imul(al4, bl9)) | 0;
    mid = (mid + Math.imul(al4, bh9)) | 0;
    mid = (mid + Math.imul(ah4, bl9)) | 0;
    hi = (hi + Math.imul(ah4, bh9)) | 0;
    var w13 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w13 >>> 26)) | 0;
    w13 &= 0x3ffffff;
    /* k = 14 */
    lo = Math.imul(al9, bl5);
    mid = Math.imul(al9, bh5);
    mid = (mid + Math.imul(ah9, bl5)) | 0;
    hi = Math.imul(ah9, bh5);
    lo = (lo + Math.imul(al8, bl6)) | 0;
    mid = (mid + Math.imul(al8, bh6)) | 0;
    mid = (mid + Math.imul(ah8, bl6)) | 0;
    hi = (hi + Math.imul(ah8, bh6)) | 0;
    lo = (lo + Math.imul(al7, bl7)) | 0;
    mid = (mid + Math.imul(al7, bh7)) | 0;
    mid = (mid + Math.imul(ah7, bl7)) | 0;
    hi = (hi + Math.imul(ah7, bh7)) | 0;
    lo = (lo + Math.imul(al6, bl8)) | 0;
    mid = (mid + Math.imul(al6, bh8)) | 0;
    mid = (mid + Math.imul(ah6, bl8)) | 0;
    hi = (hi + Math.imul(ah6, bh8)) | 0;
    lo = (lo + Math.imul(al5, bl9)) | 0;
    mid = (mid + Math.imul(al5, bh9)) | 0;
    mid = (mid + Math.imul(ah5, bl9)) | 0;
    hi = (hi + Math.imul(ah5, bh9)) | 0;
    var w14 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w14 >>> 26)) | 0;
    w14 &= 0x3ffffff;
    /* k = 15 */
    lo = Math.imul(al9, bl6);
    mid = Math.imul(al9, bh6);
    mid = (mid + Math.imul(ah9, bl6)) | 0;
    hi = Math.imul(ah9, bh6);
    lo = (lo + Math.imul(al8, bl7)) | 0;
    mid = (mid + Math.imul(al8, bh7)) | 0;
    mid = (mid + Math.imul(ah8, bl7)) | 0;
    hi = (hi + Math.imul(ah8, bh7)) | 0;
    lo = (lo + Math.imul(al7, bl8)) | 0;
    mid = (mid + Math.imul(al7, bh8)) | 0;
    mid = (mid + Math.imul(ah7, bl8)) | 0;
    hi = (hi + Math.imul(ah7, bh8)) | 0;
    lo = (lo + Math.imul(al6, bl9)) | 0;
    mid = (mid + Math.imul(al6, bh9)) | 0;
    mid = (mid + Math.imul(ah6, bl9)) | 0;
    hi = (hi + Math.imul(ah6, bh9)) | 0;
    var w15 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w15 >>> 26)) | 0;
    w15 &= 0x3ffffff;
    /* k = 16 */
    lo = Math.imul(al9, bl7);
    mid = Math.imul(al9, bh7);
    mid = (mid + Math.imul(ah9, bl7)) | 0;
    hi = Math.imul(ah9, bh7);
    lo = (lo + Math.imul(al8, bl8)) | 0;
    mid = (mid + Math.imul(al8, bh8)) | 0;
    mid = (mid + Math.imul(ah8, bl8)) | 0;
    hi = (hi + Math.imul(ah8, bh8)) | 0;
    lo = (lo + Math.imul(al7, bl9)) | 0;
    mid = (mid + Math.imul(al7, bh9)) | 0;
    mid = (mid + Math.imul(ah7, bl9)) | 0;
    hi = (hi + Math.imul(ah7, bh9)) | 0;
    var w16 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w16 >>> 26)) | 0;
    w16 &= 0x3ffffff;
    /* k = 17 */
    lo = Math.imul(al9, bl8);
    mid = Math.imul(al9, bh8);
    mid = (mid + Math.imul(ah9, bl8)) | 0;
    hi = Math.imul(ah9, bh8);
    lo = (lo + Math.imul(al8, bl9)) | 0;
    mid = (mid + Math.imul(al8, bh9)) | 0;
    mid = (mid + Math.imul(ah8, bl9)) | 0;
    hi = (hi + Math.imul(ah8, bh9)) | 0;
    var w17 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w17 >>> 26)) | 0;
    w17 &= 0x3ffffff;
    /* k = 18 */
    lo = Math.imul(al9, bl9);
    mid = Math.imul(al9, bh9);
    mid = (mid + Math.imul(ah9, bl9)) | 0;
    hi = Math.imul(ah9, bh9);
    var w18 = (((c + lo) | 0) + ((mid & 0x1fff) << 13)) | 0;
    c = (((hi + (mid >>> 13)) | 0) + (w18 >>> 26)) | 0;
    w18 &= 0x3ffffff;
    o[0] = w0;
    o[1] = w1;
    o[2] = w2;
    o[3] = w3;
    o[4] = w4;
    o[5] = w5;
    o[6] = w6;
    o[7] = w7;
    o[8] = w8;
    o[9] = w9;
    o[10] = w10;
    o[11] = w11;
    o[12] = w12;
    o[13] = w13;
    o[14] = w14;
    o[15] = w15;
    o[16] = w16;
    o[17] = w17;
    o[18] = w18;
    if (c !== 0) {
      o[19] = c;
      out.length++;
    }
    return out;
  };

  // Polyfill comb
  if (!Math.imul) {
    comb10MulTo = smallMulTo;
  }

  function bigMulTo (self, num, out) {
    out.negative = num.negative ^ self.negative;
    out.length = self.length + num.length;

    var carry = 0;
    var hncarry = 0;
    for (var k = 0; k < out.length - 1; k++) {
      // Sum all words with the same `i + j = k` and accumulate `ncarry`,
      // note that ncarry could be >= 0x3ffffff
      var ncarry = hncarry;
      hncarry = 0;
      var rword = carry & 0x3ffffff;
      var maxJ = Math.min(k, num.length - 1);
      for (var j = Math.max(0, k - self.length + 1); j <= maxJ; j++) {
        var i = k - j;
        var a = self.words[i] | 0;
        var b = num.words[j] | 0;
        var r = a * b;

        var lo = r & 0x3ffffff;
        ncarry = (ncarry + ((r / 0x4000000) | 0)) | 0;
        lo = (lo + rword) | 0;
        rword = lo & 0x3ffffff;
        ncarry = (ncarry + (lo >>> 26)) | 0;

        hncarry += ncarry >>> 26;
        ncarry &= 0x3ffffff;
      }
      out.words[k] = rword;
      carry = ncarry;
      ncarry = hncarry;
    }
    if (carry !== 0) {
      out.words[k] = carry;
    } else {
      out.length--;
    }

    return out.strip();
  }

  function jumboMulTo (self, num, out) {
    var fftm = new FFTM();
    return fftm.mulp(self, num, out);
  }

  BN.prototype.mulTo = function mulTo (num, out) {
    var res;
    var len = this.length + num.length;
    if (this.length === 10 && num.length === 10) {
      res = comb10MulTo(this, num, out);
    } else if (len < 63) {
      res = smallMulTo(this, num, out);
    } else if (len < 1024) {
      res = bigMulTo(this, num, out);
    } else {
      res = jumboMulTo(this, num, out);
    }

    return res;
  };

  // Cooley-Tukey algorithm for FFT
  // slightly revisited to rely on looping instead of recursion

  function FFTM (x, y) {
    this.x = x;
    this.y = y;
  }

  FFTM.prototype.makeRBT = function makeRBT (N) {
    var t = new Array(N);
    var l = BN.prototype._countBits(N) - 1;
    for (var i = 0; i < N; i++) {
      t[i] = this.revBin(i, l, N);
    }

    return t;
  };

  // Returns binary-reversed representation of `x`
  FFTM.prototype.revBin = function revBin (x, l, N) {
    if (x === 0 || x === N - 1) return x;

    var rb = 0;
    for (var i = 0; i < l; i++) {
      rb |= (x & 1) << (l - i - 1);
      x >>= 1;
    }

    return rb;
  };

  // Performs "tweedling" phase, therefore 'emulating'
  // behaviour of the recursive algorithm
  FFTM.prototype.permute = function permute (rbt, rws, iws, rtws, itws, N) {
    for (var i = 0; i < N; i++) {
      rtws[i] = rws[rbt[i]];
      itws[i] = iws[rbt[i]];
    }
  };

  FFTM.prototype.transform = function transform (rws, iws, rtws, itws, N, rbt) {
    this.permute(rbt, rws, iws, rtws, itws, N);

    for (var s = 1; s < N; s <<= 1) {
      var l = s << 1;

      var rtwdf = Math.cos(2 * Math.PI / l);
      var itwdf = Math.sin(2 * Math.PI / l);

      for (var p = 0; p < N; p += l) {
        var rtwdf_ = rtwdf;
        var itwdf_ = itwdf;

        for (var j = 0; j < s; j++) {
          var re = rtws[p + j];
          var ie = itws[p + j];

          var ro = rtws[p + j + s];
          var io = itws[p + j + s];

          var rx = rtwdf_ * ro - itwdf_ * io;

          io = rtwdf_ * io + itwdf_ * ro;
          ro = rx;

          rtws[p + j] = re + ro;
          itws[p + j] = ie + io;

          rtws[p + j + s] = re - ro;
          itws[p + j + s] = ie - io;

          /* jshint maxdepth : false */
          if (j !== l) {
            rx = rtwdf * rtwdf_ - itwdf * itwdf_;

            itwdf_ = rtwdf * itwdf_ + itwdf * rtwdf_;
            rtwdf_ = rx;
          }
        }
      }
    }
  };

  FFTM.prototype.guessLen13b = function guessLen13b (n, m) {
    var N = Math.max(m, n) | 1;
    var odd = N & 1;
    var i = 0;
    for (N = N / 2 | 0; N; N = N >>> 1) {
      i++;
    }

    return 1 << i + 1 + odd;
  };

  FFTM.prototype.conjugate = function conjugate (rws, iws, N) {
    if (N <= 1) return;

    for (var i = 0; i < N / 2; i++) {
      var t = rws[i];

      rws[i] = rws[N - i - 1];
      rws[N - i - 1] = t;

      t = iws[i];

      iws[i] = -iws[N - i - 1];
      iws[N - i - 1] = -t;
    }
  };

  FFTM.prototype.normalize13b = function normalize13b (ws, N) {
    var carry = 0;
    for (var i = 0; i < N / 2; i++) {
      var w = Math.round(ws[2 * i + 1] / N) * 0x2000 +
        Math.round(ws[2 * i] / N) +
        carry;

      ws[i] = w & 0x3ffffff;

      if (w < 0x4000000) {
        carry = 0;
      } else {
        carry = w / 0x4000000 | 0;
      }
    }

    return ws;
  };

  FFTM.prototype.convert13b = function convert13b (ws, len, rws, N) {
    var carry = 0;
    for (var i = 0; i < len; i++) {
      carry = carry + (ws[i] | 0);

      rws[2 * i] = carry & 0x1fff; carry = carry >>> 13;
      rws[2 * i + 1] = carry & 0x1fff; carry = carry >>> 13;
    }

    // Pad with zeroes
    for (i = 2 * len; i < N; ++i) {
      rws[i] = 0;
    }

    assert(carry === 0);
    assert((carry & ~0x1fff) === 0);
  };

  FFTM.prototype.stub = function stub (N) {
    var ph = new Array(N);
    for (var i = 0; i < N; i++) {
      ph[i] = 0;
    }

    return ph;
  };

  FFTM.prototype.mulp = function mulp (x, y, out) {
    var N = 2 * this.guessLen13b(x.length, y.length);

    var rbt = this.makeRBT(N);

    var _ = this.stub(N);

    var rws = new Array(N);
    var rwst = new Array(N);
    var iwst = new Array(N);

    var nrws = new Array(N);
    var nrwst = new Array(N);
    var niwst = new Array(N);

    var rmws = out.words;
    rmws.length = N;

    this.convert13b(x.words, x.length, rws, N);
    this.convert13b(y.words, y.length, nrws, N);

    this.transform(rws, _, rwst, iwst, N, rbt);
    this.transform(nrws, _, nrwst, niwst, N, rbt);

    for (var i = 0; i < N; i++) {
      var rx = rwst[i] * nrwst[i] - iwst[i] * niwst[i];
      iwst[i] = rwst[i] * niwst[i] + iwst[i] * nrwst[i];
      rwst[i] = rx;
    }

    this.conjugate(rwst, iwst, N);
    this.transform(rwst, iwst, rmws, _, N, rbt);
    this.conjugate(rmws, _, N);
    this.normalize13b(rmws, N);

    out.negative = x.negative ^ y.negative;
    out.length = x.length + y.length;
    return out.strip();
  };

  // Multiply `this` by `num`
  BN.prototype.mul = function mul (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return this.mulTo(num, out);
  };

  // Multiply employing FFT
  BN.prototype.mulf = function mulf (num) {
    var out = new BN(null);
    out.words = new Array(this.length + num.length);
    return jumboMulTo(this, num, out);
  };

  // In-place Multiplication
  BN.prototype.imul = function imul (num) {
    return this.clone().mulTo(num, this);
  };

  BN.prototype.imuln = function imuln (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);

    // Carry
    var carry = 0;
    for (var i = 0; i < this.length; i++) {
      var w = (this.words[i] | 0) * num;
      var lo = (w & 0x3ffffff) + (carry & 0x3ffffff);
      carry >>= 26;
      carry += (w / 0x4000000) | 0;
      // NOTE: lo is 27bit maximum
      carry += lo >>> 26;
      this.words[i] = lo & 0x3ffffff;
    }

    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }

    return this;
  };

  BN.prototype.muln = function muln (num) {
    return this.clone().imuln(num);
  };

  // `this` * `this`
  BN.prototype.sqr = function sqr () {
    return this.mul(this);
  };

  // `this` * `this` in-place
  BN.prototype.isqr = function isqr () {
    return this.imul(this.clone());
  };

  // Math.pow(`this`, `num`)
  BN.prototype.pow = function pow (num) {
    var w = toBitArray(num);
    if (w.length === 0) return new BN(1);

    // Skip leading zeroes
    var res = this;
    for (var i = 0; i < w.length; i++, res = res.sqr()) {
      if (w[i] !== 0) break;
    }

    if (++i < w.length) {
      for (var q = res.sqr(); i < w.length; i++, q = q.sqr()) {
        if (w[i] === 0) continue;

        res = res.mul(q);
      }
    }

    return res;
  };

  // Shift-left in-place
  BN.prototype.iushln = function iushln (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;
    var carryMask = (0x3ffffff >>> (26 - r)) << (26 - r);
    var i;

    if (r !== 0) {
      var carry = 0;

      for (i = 0; i < this.length; i++) {
        var newCarry = this.words[i] & carryMask;
        var c = ((this.words[i] | 0) - newCarry) << r;
        this.words[i] = c | carry;
        carry = newCarry >>> (26 - r);
      }

      if (carry) {
        this.words[i] = carry;
        this.length++;
      }
    }

    if (s !== 0) {
      for (i = this.length - 1; i >= 0; i--) {
        this.words[i + s] = this.words[i];
      }

      for (i = 0; i < s; i++) {
        this.words[i] = 0;
      }

      this.length += s;
    }

    return this.strip();
  };

  BN.prototype.ishln = function ishln (bits) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushln(bits);
  };

  // Shift-right in-place
  // NOTE: `hint` is a lowest bit before trailing zeroes
  // NOTE: if `extended` is present - it will be filled with destroyed bits
  BN.prototype.iushrn = function iushrn (bits, hint, extended) {
    assert(typeof bits === 'number' && bits >= 0);
    var h;
    if (hint) {
      h = (hint - (hint % 26)) / 26;
    } else {
      h = 0;
    }

    var r = bits % 26;
    var s = Math.min((bits - r) / 26, this.length);
    var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
    var maskedWords = extended;

    h -= s;
    h = Math.max(0, h);

    // Extended mode, copy masked part
    if (maskedWords) {
      for (var i = 0; i < s; i++) {
        maskedWords.words[i] = this.words[i];
      }
      maskedWords.length = s;
    }

    if (s === 0) {
      // No-op, we should not move anything at all
    } else if (this.length > s) {
      this.length -= s;
      for (i = 0; i < this.length; i++) {
        this.words[i] = this.words[i + s];
      }
    } else {
      this.words[0] = 0;
      this.length = 1;
    }

    var carry = 0;
    for (i = this.length - 1; i >= 0 && (carry !== 0 || i >= h); i--) {
      var word = this.words[i] | 0;
      this.words[i] = (carry << (26 - r)) | (word >>> r);
      carry = word & mask;
    }

    // Push carried bits as a mask
    if (maskedWords && carry !== 0) {
      maskedWords.words[maskedWords.length++] = carry;
    }

    if (this.length === 0) {
      this.words[0] = 0;
      this.length = 1;
    }

    return this.strip();
  };

  BN.prototype.ishrn = function ishrn (bits, hint, extended) {
    // TODO(indutny): implement me
    assert(this.negative === 0);
    return this.iushrn(bits, hint, extended);
  };

  // Shift-left
  BN.prototype.shln = function shln (bits) {
    return this.clone().ishln(bits);
  };

  BN.prototype.ushln = function ushln (bits) {
    return this.clone().iushln(bits);
  };

  // Shift-right
  BN.prototype.shrn = function shrn (bits) {
    return this.clone().ishrn(bits);
  };

  BN.prototype.ushrn = function ushrn (bits) {
    return this.clone().iushrn(bits);
  };

  // Test if n bit is set
  BN.prototype.testn = function testn (bit) {
    assert(typeof bit === 'number' && bit >= 0);
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) return false;

    // Check bit and return
    var w = this.words[s];

    return !!(w & q);
  };

  // Return only lowers bits of number (in-place)
  BN.prototype.imaskn = function imaskn (bits) {
    assert(typeof bits === 'number' && bits >= 0);
    var r = bits % 26;
    var s = (bits - r) / 26;

    assert(this.negative === 0, 'imaskn works only with positive numbers');

    if (this.length <= s) {
      return this;
    }

    if (r !== 0) {
      s++;
    }
    this.length = Math.min(s, this.length);

    if (r !== 0) {
      var mask = 0x3ffffff ^ ((0x3ffffff >>> r) << r);
      this.words[this.length - 1] &= mask;
    }

    return this.strip();
  };

  // Return only lowers bits of number
  BN.prototype.maskn = function maskn (bits) {
    return this.clone().imaskn(bits);
  };

  // Add plain number `num` to `this`
  BN.prototype.iaddn = function iaddn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.isubn(-num);

    // Possible sign change
    if (this.negative !== 0) {
      if (this.length === 1 && (this.words[0] | 0) < num) {
        this.words[0] = num - (this.words[0] | 0);
        this.negative = 0;
        return this;
      }

      this.negative = 0;
      this.isubn(num);
      this.negative = 1;
      return this;
    }

    // Add without checks
    return this._iaddn(num);
  };

  BN.prototype._iaddn = function _iaddn (num) {
    this.words[0] += num;

    // Carry
    for (var i = 0; i < this.length && this.words[i] >= 0x4000000; i++) {
      this.words[i] -= 0x4000000;
      if (i === this.length - 1) {
        this.words[i + 1] = 1;
      } else {
        this.words[i + 1]++;
      }
    }
    this.length = Math.max(this.length, i + 1);

    return this;
  };

  // Subtract plain number `num` from `this`
  BN.prototype.isubn = function isubn (num) {
    assert(typeof num === 'number');
    assert(num < 0x4000000);
    if (num < 0) return this.iaddn(-num);

    if (this.negative !== 0) {
      this.negative = 0;
      this.iaddn(num);
      this.negative = 1;
      return this;
    }

    this.words[0] -= num;

    if (this.length === 1 && this.words[0] < 0) {
      this.words[0] = -this.words[0];
      this.negative = 1;
    } else {
      // Carry
      for (var i = 0; i < this.length && this.words[i] < 0; i++) {
        this.words[i] += 0x4000000;
        this.words[i + 1] -= 1;
      }
    }

    return this.strip();
  };

  BN.prototype.addn = function addn (num) {
    return this.clone().iaddn(num);
  };

  BN.prototype.subn = function subn (num) {
    return this.clone().isubn(num);
  };

  BN.prototype.iabs = function iabs () {
    this.negative = 0;

    return this;
  };

  BN.prototype.abs = function abs () {
    return this.clone().iabs();
  };

  BN.prototype._ishlnsubmul = function _ishlnsubmul (num, mul, shift) {
    var len = num.length + shift;
    var i;

    this._expand(len);

    var w;
    var carry = 0;
    for (i = 0; i < num.length; i++) {
      w = (this.words[i + shift] | 0) + carry;
      var right = (num.words[i] | 0) * mul;
      w -= right & 0x3ffffff;
      carry = (w >> 26) - ((right / 0x4000000) | 0);
      this.words[i + shift] = w & 0x3ffffff;
    }
    for (; i < this.length - shift; i++) {
      w = (this.words[i + shift] | 0) + carry;
      carry = w >> 26;
      this.words[i + shift] = w & 0x3ffffff;
    }

    if (carry === 0) return this.strip();

    // Subtraction overflow
    assert(carry === -1);
    carry = 0;
    for (i = 0; i < this.length; i++) {
      w = -(this.words[i] | 0) + carry;
      carry = w >> 26;
      this.words[i] = w & 0x3ffffff;
    }
    this.negative = 1;

    return this.strip();
  };

  BN.prototype._wordDiv = function _wordDiv (num, mode) {
    var shift = this.length - num.length;

    var a = this.clone();
    var b = num;

    // Normalize
    var bhi = b.words[b.length - 1] | 0;
    var bhiBits = this._countBits(bhi);
    shift = 26 - bhiBits;
    if (shift !== 0) {
      b = b.ushln(shift);
      a.iushln(shift);
      bhi = b.words[b.length - 1] | 0;
    }

    // Initialize quotient
    var m = a.length - b.length;
    var q;

    if (mode !== 'mod') {
      q = new BN(null);
      q.length = m + 1;
      q.words = new Array(q.length);
      for (var i = 0; i < q.length; i++) {
        q.words[i] = 0;
      }
    }

    var diff = a.clone()._ishlnsubmul(b, 1, m);
    if (diff.negative === 0) {
      a = diff;
      if (q) {
        q.words[m] = 1;
      }
    }

    for (var j = m - 1; j >= 0; j--) {
      var qj = (a.words[b.length + j] | 0) * 0x4000000 +
        (a.words[b.length + j - 1] | 0);

      // NOTE: (qj / bhi) is (0x3ffffff * 0x4000000 + 0x3ffffff) / 0x2000000 max
      // (0x7ffffff)
      qj = Math.min((qj / bhi) | 0, 0x3ffffff);

      a._ishlnsubmul(b, qj, j);
      while (a.negative !== 0) {
        qj--;
        a.negative = 0;
        a._ishlnsubmul(b, 1, j);
        if (!a.isZero()) {
          a.negative ^= 1;
        }
      }
      if (q) {
        q.words[j] = qj;
      }
    }
    if (q) {
      q.strip();
    }
    a.strip();

    // Denormalize
    if (mode !== 'div' && shift !== 0) {
      a.iushrn(shift);
    }

    return {
      div: q || null,
      mod: a
    };
  };

  // NOTE: 1) `mode` can be set to `mod` to request mod only,
  //       to `div` to request div only, or be absent to
  //       request both div & mod
  //       2) `positive` is true if unsigned mod is requested
  BN.prototype.divmod = function divmod (num, mode, positive) {
    assert(!num.isZero());

    if (this.isZero()) {
      return {
        div: new BN(0),
        mod: new BN(0)
      };
    }

    var div, mod, res;
    if (this.negative !== 0 && num.negative === 0) {
      res = this.neg().divmod(num, mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.iadd(num);
        }
      }

      return {
        div: div,
        mod: mod
      };
    }

    if (this.negative === 0 && num.negative !== 0) {
      res = this.divmod(num.neg(), mode);

      if (mode !== 'mod') {
        div = res.div.neg();
      }

      return {
        div: div,
        mod: res.mod
      };
    }

    if ((this.negative & num.negative) !== 0) {
      res = this.neg().divmod(num.neg(), mode);

      if (mode !== 'div') {
        mod = res.mod.neg();
        if (positive && mod.negative !== 0) {
          mod.isub(num);
        }
      }

      return {
        div: res.div,
        mod: mod
      };
    }

    // Both numbers are positive at this point

    // Strip both numbers to approximate shift value
    if (num.length > this.length || this.cmp(num) < 0) {
      return {
        div: new BN(0),
        mod: this
      };
    }

    // Very short reduction
    if (num.length === 1) {
      if (mode === 'div') {
        return {
          div: this.divn(num.words[0]),
          mod: null
        };
      }

      if (mode === 'mod') {
        return {
          div: null,
          mod: new BN(this.modn(num.words[0]))
        };
      }

      return {
        div: this.divn(num.words[0]),
        mod: new BN(this.modn(num.words[0]))
      };
    }

    return this._wordDiv(num, mode);
  };

  // Find `this` / `num`
  BN.prototype.div = function div (num) {
    return this.divmod(num, 'div', false).div;
  };

  // Find `this` % `num`
  BN.prototype.mod = function mod (num) {
    return this.divmod(num, 'mod', false).mod;
  };

  BN.prototype.umod = function umod (num) {
    return this.divmod(num, 'mod', true).mod;
  };

  // Find Round(`this` / `num`)
  BN.prototype.divRound = function divRound (num) {
    var dm = this.divmod(num);

    // Fast case - exact division
    if (dm.mod.isZero()) return dm.div;

    var mod = dm.div.negative !== 0 ? dm.mod.isub(num) : dm.mod;

    var half = num.ushrn(1);
    var r2 = num.andln(1);
    var cmp = mod.cmp(half);

    // Round down
    if (cmp < 0 || r2 === 1 && cmp === 0) return dm.div;

    // Round up
    return dm.div.negative !== 0 ? dm.div.isubn(1) : dm.div.iaddn(1);
  };

  BN.prototype.modn = function modn (num) {
    assert(num <= 0x3ffffff);
    var p = (1 << 26) % num;

    var acc = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      acc = (p * acc + (this.words[i] | 0)) % num;
    }

    return acc;
  };

  // In-place division by number
  BN.prototype.idivn = function idivn (num) {
    assert(num <= 0x3ffffff);

    var carry = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var w = (this.words[i] | 0) + carry * 0x4000000;
      this.words[i] = (w / num) | 0;
      carry = w % num;
    }

    return this.strip();
  };

  BN.prototype.divn = function divn (num) {
    return this.clone().idivn(num);
  };

  BN.prototype.egcd = function egcd (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var x = this;
    var y = p.clone();

    if (x.negative !== 0) {
      x = x.umod(p);
    } else {
      x = x.clone();
    }

    // A * x + B * y = x
    var A = new BN(1);
    var B = new BN(0);

    // C * x + D * y = y
    var C = new BN(0);
    var D = new BN(1);

    var g = 0;

    while (x.isEven() && y.isEven()) {
      x.iushrn(1);
      y.iushrn(1);
      ++g;
    }

    var yp = y.clone();
    var xp = x.clone();

    while (!x.isZero()) {
      for (var i = 0, im = 1; (x.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        x.iushrn(i);
        while (i-- > 0) {
          if (A.isOdd() || B.isOdd()) {
            A.iadd(yp);
            B.isub(xp);
          }

          A.iushrn(1);
          B.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (y.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        y.iushrn(j);
        while (j-- > 0) {
          if (C.isOdd() || D.isOdd()) {
            C.iadd(yp);
            D.isub(xp);
          }

          C.iushrn(1);
          D.iushrn(1);
        }
      }

      if (x.cmp(y) >= 0) {
        x.isub(y);
        A.isub(C);
        B.isub(D);
      } else {
        y.isub(x);
        C.isub(A);
        D.isub(B);
      }
    }

    return {
      a: C,
      b: D,
      gcd: y.iushln(g)
    };
  };

  // This is reduced incarnation of the binary EEA
  // above, designated to invert members of the
  // _prime_ fields F(p) at a maximal speed
  BN.prototype._invmp = function _invmp (p) {
    assert(p.negative === 0);
    assert(!p.isZero());

    var a = this;
    var b = p.clone();

    if (a.negative !== 0) {
      a = a.umod(p);
    } else {
      a = a.clone();
    }

    var x1 = new BN(1);
    var x2 = new BN(0);

    var delta = b.clone();

    while (a.cmpn(1) > 0 && b.cmpn(1) > 0) {
      for (var i = 0, im = 1; (a.words[0] & im) === 0 && i < 26; ++i, im <<= 1);
      if (i > 0) {
        a.iushrn(i);
        while (i-- > 0) {
          if (x1.isOdd()) {
            x1.iadd(delta);
          }

          x1.iushrn(1);
        }
      }

      for (var j = 0, jm = 1; (b.words[0] & jm) === 0 && j < 26; ++j, jm <<= 1);
      if (j > 0) {
        b.iushrn(j);
        while (j-- > 0) {
          if (x2.isOdd()) {
            x2.iadd(delta);
          }

          x2.iushrn(1);
        }
      }

      if (a.cmp(b) >= 0) {
        a.isub(b);
        x1.isub(x2);
      } else {
        b.isub(a);
        x2.isub(x1);
      }
    }

    var res;
    if (a.cmpn(1) === 0) {
      res = x1;
    } else {
      res = x2;
    }

    if (res.cmpn(0) < 0) {
      res.iadd(p);
    }

    return res;
  };

  BN.prototype.gcd = function gcd (num) {
    if (this.isZero()) return num.abs();
    if (num.isZero()) return this.abs();

    var a = this.clone();
    var b = num.clone();
    a.negative = 0;
    b.negative = 0;

    // Remove common factor of two
    for (var shift = 0; a.isEven() && b.isEven(); shift++) {
      a.iushrn(1);
      b.iushrn(1);
    }

    do {
      while (a.isEven()) {
        a.iushrn(1);
      }
      while (b.isEven()) {
        b.iushrn(1);
      }

      var r = a.cmp(b);
      if (r < 0) {
        // Swap `a` and `b` to make `a` always bigger than `b`
        var t = a;
        a = b;
        b = t;
      } else if (r === 0 || b.cmpn(1) === 0) {
        break;
      }

      a.isub(b);
    } while (true);

    return b.iushln(shift);
  };

  // Invert number in the field F(num)
  BN.prototype.invm = function invm (num) {
    return this.egcd(num).a.umod(num);
  };

  BN.prototype.isEven = function isEven () {
    return (this.words[0] & 1) === 0;
  };

  BN.prototype.isOdd = function isOdd () {
    return (this.words[0] & 1) === 1;
  };

  // And first word and num
  BN.prototype.andln = function andln (num) {
    return this.words[0] & num;
  };

  // Increment at the bit position in-line
  BN.prototype.bincn = function bincn (bit) {
    assert(typeof bit === 'number');
    var r = bit % 26;
    var s = (bit - r) / 26;
    var q = 1 << r;

    // Fast case: bit is much higher than all existing words
    if (this.length <= s) {
      this._expand(s + 1);
      this.words[s] |= q;
      return this;
    }

    // Add bit and propagate, if needed
    var carry = q;
    for (var i = s; carry !== 0 && i < this.length; i++) {
      var w = this.words[i] | 0;
      w += carry;
      carry = w >>> 26;
      w &= 0x3ffffff;
      this.words[i] = w;
    }
    if (carry !== 0) {
      this.words[i] = carry;
      this.length++;
    }
    return this;
  };

  BN.prototype.isZero = function isZero () {
    return this.length === 1 && this.words[0] === 0;
  };

  BN.prototype.cmpn = function cmpn (num) {
    var negative = num < 0;

    if (this.negative !== 0 && !negative) return -1;
    if (this.negative === 0 && negative) return 1;

    this.strip();

    var res;
    if (this.length > 1) {
      res = 1;
    } else {
      if (negative) {
        num = -num;
      }

      assert(num <= 0x3ffffff, 'Number is too big');

      var w = this.words[0] | 0;
      res = w === num ? 0 : w < num ? -1 : 1;
    }
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Compare two numbers and return:
  // 1 - if `this` > `num`
  // 0 - if `this` == `num`
  // -1 - if `this` < `num`
  BN.prototype.cmp = function cmp (num) {
    if (this.negative !== 0 && num.negative === 0) return -1;
    if (this.negative === 0 && num.negative !== 0) return 1;

    var res = this.ucmp(num);
    if (this.negative !== 0) return -res | 0;
    return res;
  };

  // Unsigned comparison
  BN.prototype.ucmp = function ucmp (num) {
    // At this point both numbers have the same sign
    if (this.length > num.length) return 1;
    if (this.length < num.length) return -1;

    var res = 0;
    for (var i = this.length - 1; i >= 0; i--) {
      var a = this.words[i] | 0;
      var b = num.words[i] | 0;

      if (a === b) continue;
      if (a < b) {
        res = -1;
      } else if (a > b) {
        res = 1;
      }
      break;
    }
    return res;
  };

  BN.prototype.gtn = function gtn (num) {
    return this.cmpn(num) === 1;
  };

  BN.prototype.gt = function gt (num) {
    return this.cmp(num) === 1;
  };

  BN.prototype.gten = function gten (num) {
    return this.cmpn(num) >= 0;
  };

  BN.prototype.gte = function gte (num) {
    return this.cmp(num) >= 0;
  };

  BN.prototype.ltn = function ltn (num) {
    return this.cmpn(num) === -1;
  };

  BN.prototype.lt = function lt (num) {
    return this.cmp(num) === -1;
  };

  BN.prototype.lten = function lten (num) {
    return this.cmpn(num) <= 0;
  };

  BN.prototype.lte = function lte (num) {
    return this.cmp(num) <= 0;
  };

  BN.prototype.eqn = function eqn (num) {
    return this.cmpn(num) === 0;
  };

  BN.prototype.eq = function eq (num) {
    return this.cmp(num) === 0;
  };

  //
  // A reduce context, could be using montgomery or something better, depending
  // on the `m` itself.
  //
  BN.red = function red (num) {
    return new Red(num);
  };

  BN.prototype.toRed = function toRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    assert(this.negative === 0, 'red works only with positives');
    return ctx.convertTo(this)._forceRed(ctx);
  };

  BN.prototype.fromRed = function fromRed () {
    assert(this.red, 'fromRed works only with numbers in reduction context');
    return this.red.convertFrom(this);
  };

  BN.prototype._forceRed = function _forceRed (ctx) {
    this.red = ctx;
    return this;
  };

  BN.prototype.forceRed = function forceRed (ctx) {
    assert(!this.red, 'Already a number in reduction context');
    return this._forceRed(ctx);
  };

  BN.prototype.redAdd = function redAdd (num) {
    assert(this.red, 'redAdd works only with red numbers');
    return this.red.add(this, num);
  };

  BN.prototype.redIAdd = function redIAdd (num) {
    assert(this.red, 'redIAdd works only with red numbers');
    return this.red.iadd(this, num);
  };

  BN.prototype.redSub = function redSub (num) {
    assert(this.red, 'redSub works only with red numbers');
    return this.red.sub(this, num);
  };

  BN.prototype.redISub = function redISub (num) {
    assert(this.red, 'redISub works only with red numbers');
    return this.red.isub(this, num);
  };

  BN.prototype.redShl = function redShl (num) {
    assert(this.red, 'redShl works only with red numbers');
    return this.red.shl(this, num);
  };

  BN.prototype.redMul = function redMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.mul(this, num);
  };

  BN.prototype.redIMul = function redIMul (num) {
    assert(this.red, 'redMul works only with red numbers');
    this.red._verify2(this, num);
    return this.red.imul(this, num);
  };

  BN.prototype.redSqr = function redSqr () {
    assert(this.red, 'redSqr works only with red numbers');
    this.red._verify1(this);
    return this.red.sqr(this);
  };

  BN.prototype.redISqr = function redISqr () {
    assert(this.red, 'redISqr works only with red numbers');
    this.red._verify1(this);
    return this.red.isqr(this);
  };

  // Square root over p
  BN.prototype.redSqrt = function redSqrt () {
    assert(this.red, 'redSqrt works only with red numbers');
    this.red._verify1(this);
    return this.red.sqrt(this);
  };

  BN.prototype.redInvm = function redInvm () {
    assert(this.red, 'redInvm works only with red numbers');
    this.red._verify1(this);
    return this.red.invm(this);
  };

  // Return negative clone of `this` % `red modulo`
  BN.prototype.redNeg = function redNeg () {
    assert(this.red, 'redNeg works only with red numbers');
    this.red._verify1(this);
    return this.red.neg(this);
  };

  BN.prototype.redPow = function redPow (num) {
    assert(this.red && !num.red, 'redPow(normalNum)');
    this.red._verify1(this);
    return this.red.pow(this, num);
  };

  // Prime numbers with efficient reduction
  var primes = {
    k256: null,
    p224: null,
    p192: null,
    p25519: null
  };

  // Pseudo-Mersenne prime
  function MPrime (name, p) {
    // P = 2 ^ N - K
    this.name = name;
    this.p = new BN(p, 16);
    this.n = this.p.bitLength();
    this.k = new BN(1).iushln(this.n).isub(this.p);

    this.tmp = this._tmp();
  }

  MPrime.prototype._tmp = function _tmp () {
    var tmp = new BN(null);
    tmp.words = new Array(Math.ceil(this.n / 13));
    return tmp;
  };

  MPrime.prototype.ireduce = function ireduce (num) {
    // Assumes that `num` is less than `P^2`
    // num = HI * (2 ^ N - K) + HI * K + LO = HI * K + LO (mod P)
    var r = num;
    var rlen;

    do {
      this.split(r, this.tmp);
      r = this.imulK(r);
      r = r.iadd(this.tmp);
      rlen = r.bitLength();
    } while (rlen > this.n);

    var cmp = rlen < this.n ? -1 : r.ucmp(this.p);
    if (cmp === 0) {
      r.words[0] = 0;
      r.length = 1;
    } else if (cmp > 0) {
      r.isub(this.p);
    } else {
      r.strip();
    }

    return r;
  };

  MPrime.prototype.split = function split (input, out) {
    input.iushrn(this.n, 0, out);
  };

  MPrime.prototype.imulK = function imulK (num) {
    return num.imul(this.k);
  };

  function K256 () {
    MPrime.call(
      this,
      'k256',
      'ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f');
  }
  inherits(K256, MPrime);

  K256.prototype.split = function split (input, output) {
    // 256 = 9 * 26 + 22
    var mask = 0x3fffff;

    var outLen = Math.min(input.length, 9);
    for (var i = 0; i < outLen; i++) {
      output.words[i] = input.words[i];
    }
    output.length = outLen;

    if (input.length <= 9) {
      input.words[0] = 0;
      input.length = 1;
      return;
    }

    // Shift by 9 limbs
    var prev = input.words[9];
    output.words[output.length++] = prev & mask;

    for (i = 10; i < input.length; i++) {
      var next = input.words[i] | 0;
      input.words[i - 10] = ((next & mask) << 4) | (prev >>> 22);
      prev = next;
    }
    prev >>>= 22;
    input.words[i - 10] = prev;
    if (prev === 0 && input.length > 10) {
      input.length -= 10;
    } else {
      input.length -= 9;
    }
  };

  K256.prototype.imulK = function imulK (num) {
    // K = 0x1000003d1 = [ 0x40, 0x3d1 ]
    num.words[num.length] = 0;
    num.words[num.length + 1] = 0;
    num.length += 2;

    // bounded at: 0x40 * 0x3ffffff + 0x3d0 = 0x100000390
    var lo = 0;
    for (var i = 0; i < num.length; i++) {
      var w = num.words[i] | 0;
      lo += w * 0x3d1;
      num.words[i] = lo & 0x3ffffff;
      lo = w * 0x40 + ((lo / 0x4000000) | 0);
    }

    // Fast length reduction
    if (num.words[num.length - 1] === 0) {
      num.length--;
      if (num.words[num.length - 1] === 0) {
        num.length--;
      }
    }
    return num;
  };

  function P224 () {
    MPrime.call(
      this,
      'p224',
      'ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001');
  }
  inherits(P224, MPrime);

  function P192 () {
    MPrime.call(
      this,
      'p192',
      'ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff');
  }
  inherits(P192, MPrime);

  function P25519 () {
    // 2 ^ 255 - 19
    MPrime.call(
      this,
      '25519',
      '7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed');
  }
  inherits(P25519, MPrime);

  P25519.prototype.imulK = function imulK (num) {
    // K = 0x13
    var carry = 0;
    for (var i = 0; i < num.length; i++) {
      var hi = (num.words[i] | 0) * 0x13 + carry;
      var lo = hi & 0x3ffffff;
      hi >>>= 26;

      num.words[i] = lo;
      carry = hi;
    }
    if (carry !== 0) {
      num.words[num.length++] = carry;
    }
    return num;
  };

  // Exported mostly for testing purposes, use plain name instead
  BN._prime = function prime (name) {
    // Cached version of prime
    if (primes[name]) return primes[name];

    var prime;
    if (name === 'k256') {
      prime = new K256();
    } else if (name === 'p224') {
      prime = new P224();
    } else if (name === 'p192') {
      prime = new P192();
    } else if (name === 'p25519') {
      prime = new P25519();
    } else {
      throw new Error('Unknown prime ' + name);
    }
    primes[name] = prime;

    return prime;
  };

  //
  // Base reduction engine
  //
  function Red (m) {
    if (typeof m === 'string') {
      var prime = BN._prime(m);
      this.m = prime.p;
      this.prime = prime;
    } else {
      assert(m.gtn(1), 'modulus must be greater than 1');
      this.m = m;
      this.prime = null;
    }
  }

  Red.prototype._verify1 = function _verify1 (a) {
    assert(a.negative === 0, 'red works only with positives');
    assert(a.red, 'red works only with red numbers');
  };

  Red.prototype._verify2 = function _verify2 (a, b) {
    assert((a.negative | b.negative) === 0, 'red works only with positives');
    assert(a.red && a.red === b.red,
      'red works only with red numbers');
  };

  Red.prototype.imod = function imod (a) {
    if (this.prime) return this.prime.ireduce(a)._forceRed(this);
    return a.umod(this.m)._forceRed(this);
  };

  Red.prototype.neg = function neg (a) {
    if (a.isZero()) {
      return a.clone();
    }

    return this.m.sub(a)._forceRed(this);
  };

  Red.prototype.add = function add (a, b) {
    this._verify2(a, b);

    var res = a.add(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.iadd = function iadd (a, b) {
    this._verify2(a, b);

    var res = a.iadd(b);
    if (res.cmp(this.m) >= 0) {
      res.isub(this.m);
    }
    return res;
  };

  Red.prototype.sub = function sub (a, b) {
    this._verify2(a, b);

    var res = a.sub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res._forceRed(this);
  };

  Red.prototype.isub = function isub (a, b) {
    this._verify2(a, b);

    var res = a.isub(b);
    if (res.cmpn(0) < 0) {
      res.iadd(this.m);
    }
    return res;
  };

  Red.prototype.shl = function shl (a, num) {
    this._verify1(a);
    return this.imod(a.ushln(num));
  };

  Red.prototype.imul = function imul (a, b) {
    this._verify2(a, b);
    return this.imod(a.imul(b));
  };

  Red.prototype.mul = function mul (a, b) {
    this._verify2(a, b);
    return this.imod(a.mul(b));
  };

  Red.prototype.isqr = function isqr (a) {
    return this.imul(a, a.clone());
  };

  Red.prototype.sqr = function sqr (a) {
    return this.mul(a, a);
  };

  Red.prototype.sqrt = function sqrt (a) {
    if (a.isZero()) return a.clone();

    var mod3 = this.m.andln(3);
    assert(mod3 % 2 === 1);

    // Fast case
    if (mod3 === 3) {
      var pow = this.m.add(new BN(1)).iushrn(2);
      return this.pow(a, pow);
    }

    // Tonelli-Shanks algorithm (Totally unoptimized and slow)
    //
    // Find Q and S, that Q * 2 ^ S = (P - 1)
    var q = this.m.subn(1);
    var s = 0;
    while (!q.isZero() && q.andln(1) === 0) {
      s++;
      q.iushrn(1);
    }
    assert(!q.isZero());

    var one = new BN(1).toRed(this);
    var nOne = one.redNeg();

    // Find quadratic non-residue
    // NOTE: Max is such because of generalized Riemann hypothesis.
    var lpow = this.m.subn(1).iushrn(1);
    var z = this.m.bitLength();
    z = new BN(2 * z * z).toRed(this);

    while (this.pow(z, lpow).cmp(nOne) !== 0) {
      z.redIAdd(nOne);
    }

    var c = this.pow(z, q);
    var r = this.pow(a, q.addn(1).iushrn(1));
    var t = this.pow(a, q);
    var m = s;
    while (t.cmp(one) !== 0) {
      var tmp = t;
      for (var i = 0; tmp.cmp(one) !== 0; i++) {
        tmp = tmp.redSqr();
      }
      assert(i < m);
      var b = this.pow(c, new BN(1).iushln(m - i - 1));

      r = r.redMul(b);
      c = b.redSqr();
      t = t.redMul(c);
      m = i;
    }

    return r;
  };

  Red.prototype.invm = function invm (a) {
    var inv = a._invmp(this.m);
    if (inv.negative !== 0) {
      inv.negative = 0;
      return this.imod(inv).redNeg();
    } else {
      return this.imod(inv);
    }
  };

  Red.prototype.pow = function pow (a, num) {
    if (num.isZero()) return new BN(1).toRed(this);
    if (num.cmpn(1) === 0) return a.clone();

    var windowSize = 4;
    var wnd = new Array(1 << windowSize);
    wnd[0] = new BN(1).toRed(this);
    wnd[1] = a;
    for (var i = 2; i < wnd.length; i++) {
      wnd[i] = this.mul(wnd[i - 1], a);
    }

    var res = wnd[0];
    var current = 0;
    var currentLen = 0;
    var start = num.bitLength() % 26;
    if (start === 0) {
      start = 26;
    }

    for (i = num.length - 1; i >= 0; i--) {
      var word = num.words[i];
      for (var j = start - 1; j >= 0; j--) {
        var bit = (word >> j) & 1;
        if (res !== wnd[0]) {
          res = this.sqr(res);
        }

        if (bit === 0 && current === 0) {
          currentLen = 0;
          continue;
        }

        current <<= 1;
        current |= bit;
        currentLen++;
        if (currentLen !== windowSize && (i !== 0 || j !== 0)) continue;

        res = this.mul(res, wnd[current]);
        currentLen = 0;
        current = 0;
      }
      start = 26;
    }

    return res;
  };

  Red.prototype.convertTo = function convertTo (num) {
    var r = num.umod(this.m);

    return r === num ? r.clone() : r;
  };

  Red.prototype.convertFrom = function convertFrom (num) {
    var res = num.clone();
    res.red = null;
    return res;
  };

  //
  // Montgomery method engine
  //

  BN.mont = function mont (num) {
    return new Mont(num);
  };

  function Mont (m) {
    Red.call(this, m);

    this.shift = this.m.bitLength();
    if (this.shift % 26 !== 0) {
      this.shift += 26 - (this.shift % 26);
    }

    this.r = new BN(1).iushln(this.shift);
    this.r2 = this.imod(this.r.sqr());
    this.rinv = this.r._invmp(this.m);

    this.minv = this.rinv.mul(this.r).isubn(1).div(this.m);
    this.minv = this.minv.umod(this.r);
    this.minv = this.r.sub(this.minv);
  }
  inherits(Mont, Red);

  Mont.prototype.convertTo = function convertTo (num) {
    return this.imod(num.ushln(this.shift));
  };

  Mont.prototype.convertFrom = function convertFrom (num) {
    var r = this.imod(num.mul(this.rinv));
    r.red = null;
    return r;
  };

  Mont.prototype.imul = function imul (a, b) {
    if (a.isZero() || b.isZero()) {
      a.words[0] = 0;
      a.length = 1;
      return a;
    }

    var t = a.imul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;

    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.mul = function mul (a, b) {
    if (a.isZero() || b.isZero()) return new BN(0)._forceRed(this);

    var t = a.mul(b);
    var c = t.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m);
    var u = t.isub(c).iushrn(this.shift);
    var res = u;
    if (u.cmp(this.m) >= 0) {
      res = u.isub(this.m);
    } else if (u.cmpn(0) < 0) {
      res = u.iadd(this.m);
    }

    return res._forceRed(this);
  };

  Mont.prototype.invm = function invm (a) {
    // (AR)^-1 * R^2 = (A^-1 * R^-1) * R^2 = A^-1 * R
    var res = this.imod(a._invmp(this.m).mul(this.r2));
    return res._forceRed(this);
  };
})(typeof module === 'undefined' || module, this);

},{"buffer":3}],3:[function(require,module,exports){

},{}],4:[function(require,module,exports){
'use strict';

try {
    module.exports.XMLHttpRequest = XMLHttpRequest;
} catch(error) {
    console.log('Warning: XMLHttpRequest is not defined');
    module.exports.XMLHttpRequest = null;
}

},{}],5:[function(require,module,exports){
'use strict';

var Provider = require('./provider.js');

var utils = (function() {
    var convert = require('ethers-utils/convert.js');
    return {
        defineProperty: require('ethers-utils/properties.js').defineProperty,

        hexlify: convert.hexlify,
    };
})();

// @TODO: Add this to utils; lots of things need this now
function stripHexZeros(value) {
    while (value.length > 3 && value.substring(0, 3) === '0x0') {
        value = '0x' + value.substring(3);
    }
    return value;
}

function getTransactionString(transaction) {
    var result = [];
    for (var key in transaction) {
        if (transaction[key] == null) { continue; }
        var value = utils.hexlify(transaction[key]);
        if ({ gasLimit: true, gasPrice: true, nonce: true, value: true }[key]) {
            value = stripHexZeros(value);
        }
        result.push(key + '=' + value);
    }
    return result.join('&');
}

function EtherscanProvider(network, apiKey) {
    Provider.call(this, network);

    var baseUrl = null;
    switch(this.name) {
        case 'homestead':
            baseUrl = 'https://api.etherscan.io';
            break;
        case 'ropsten':
            baseUrl = 'https://ropsten.etherscan.io';
            break;
        case 'rinkeby':
            baseUrl = 'https://rinkeby.etherscan.io';
            break;
        case 'kovan':
            baseUrl = 'https://kovan.etherscan.io';
            break;
        default:
            throw new Error('unsupported network');
    }
    utils.defineProperty(this, 'baseUrl', baseUrl);

    utils.defineProperty(this, 'apiKey', apiKey || null);
}
Provider.inherits(EtherscanProvider);

utils.defineProperty(EtherscanProvider.prototype, '_call', function() {
});

utils.defineProperty(EtherscanProvider.prototype, '_callProxy', function() {
});

function getResult(result) {
    // getLogs has weird success responses
    if (result.status == 0 && result.message === 'No records found') {
        return result.result;
    }

    if (result.status != 1 || result.message != 'OK') {
        var error = new Error('invalid response');
        error.result = JSON.stringify(result);
        throw error;
    }

    return result.result;
}

function getJsonResult(result) {
    if (result.jsonrpc != '2.0') {
        var error = new Error('invalid response');
        error.result = JSON.stringify(result);
        throw error;
    }

    if (result.error) {
        var error = new Error(result.error.message || 'unknown error');
        if (result.error.code) { error.code = result.error.code; }
        if (result.error.data) { error.data = result.error.data; }
        throw error;
    }

    return result.result;
}

function checkLogTag(blockTag) {
    if (blockTag === 'pending') { throw new Error('pending not supported'); }
    if (blockTag === 'latest') { return blockTag; }

    return parseInt(blockTag.substring(2), 16);
}


utils.defineProperty(EtherscanProvider.prototype, 'perform', function(method, params) {
    if (!params) { params = {}; }

    var url = this.baseUrl;

    var apiKey = '';
    if (this.apiKey) { apiKey += '&apikey=' + this.apiKey; }

    switch (method) {
        case 'getBlockNumber':
            url += '/api?module=proxy&action=eth_blockNumber' + apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'getGasPrice':
            url += '/api?module=proxy&action=eth_gasPrice' + apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);


        case 'getBalance':
            // Returns base-10 result
            url += '/api?module=account&action=balance&address=' + params.address;
            url += '&tag=' + params.blockTag + apiKey;
            return Provider.fetchJSON(url, null, getResult);

        case 'getTransactionCount':
            url += '/api?module=proxy&action=eth_getTransactionCount&address=' + params.address;
            url += '&tag=' + params.blockTag + apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'getCode':
            url += '/api?module=proxy&action=eth_getCode&address=' + params.address;
            url += '&tag=' + params.blockTag + apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'getStorageAt':
            url += '/api?module=proxy&action=eth_getStorageAt&address=' + params.address;
            url += '&position=' + stripHexZeros(params.position);
            url += '&tag=' + stripHexZeros(params.blockTag) + apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'sendTransaction':
            url += '/api?module=proxy&action=eth_sendRawTransaction&hex=' + params.signedTransaction;
            url += apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);


        case 'getBlock':
            if (params.blockTag) {
                url += '/api?module=proxy&action=eth_getBlockByNumber&tag=' + stripHexZeros(params.blockTag);
                url += '&boolean=false';
                url += apiKey;
                return Provider.fetchJSON(url, null, getJsonResult);
            }
            throw new Error('getBlock by blockHash not implmeneted');

        case 'getTransaction':
            url += '/api?module=proxy&action=eth_getTransactionByHash&txhash=' + params.transactionHash;
            url += apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'getTransactionReceipt':
            url += '/api?module=proxy&action=eth_getTransactionReceipt&txhash=' + params.transactionHash;
            url += apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);


        case 'call':
            var transaction = getTransactionString(params.transaction);
            if (transaction) { transaction = '&' + transaction; }
            url += '/api?module=proxy&action=eth_call' + transaction;
            url += apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'estimateGas':
            var transaction = getTransactionString(params.transaction);
            if (transaction) { transaction = '&' + transaction; }
            url += '/api?module=proxy&action=eth_estimateGas&' + transaction;
            url += apiKey;
            return Provider.fetchJSON(url, null, getJsonResult);

        case 'getLogs':
            url += '/api?module=logs&action=getLogs';
            try {
                if (params.filter.fromBlock) {
                    url += '&fromBlock=' + checkLogTag(params.filter.fromBlock);
                }

                if (params.filter.toBlock) {
                    url += '&toBlock=' + checkLogTag(params.filter.toBlock);
                }

                if (params.filter.address) {
                    url += '&address=' + params.filter.address;
                }

                // @TODO: We can handle slightly more complicated logs using the logs API
                if (params.filter.topics && params.filter.topics.length > 0) {
                    if (params.filter.topics.length > 1) {
                        throw new Error('unsupported topic format');
                    }
                    var topic0 = params.filter.topics[0];
                    if (typeof(topic0) !== 'string' || topic0.length !== 66) {
                        throw new Error('unsupported topic0 format');
                    }
                    url += '&topic0=' + topic0;
                }
            } catch (error) {
                return Promise.reject(error);
            }


            url += apiKey;
            return Provider.fetchJSON(url, null, getResult);

        case 'getEtherPrice':
            if (this.name !== 'homestead') { return Promise.resolve(0.0); }
            url += '/api?module=stats&action=ethprice';
            url += apiKey;
            return Provider.fetchJSON(url, null, getResult).then(function(result) {
                return parseFloat(result.ethusd);
            });

        default:
            break;
    }

    return Promise.reject(new Error('not implemented - ' + method));
});

utils.defineProperty(EtherscanProvider.prototype, 'getHistory', function(addressOrName, startBlock, endBlock) {

    var url = this.baseUrl;

    var apiKey = '';
    if (this.apiKey) { apiKey += '&apikey=' + this.apiKey; }

    if (startBlock == null) { startBlock = 0; }
    if (endBlock == null) { endBlock = 99999999; }

    return this.resolveName(addressOrName).then(function(address) {
        url += '/api?module=account&action=txlist&address=' + address;
        url += '&fromBlock=' + startBlock;
        url += '&endBlock=' + endBlock;
        url += '&sort=asc';

        return Provider.fetchJSON(url, null, getResult).then(function(result) {
            var output = [];
            result.forEach(function(tx) {
                ['contractAddress', 'to'].forEach(function(key) {
                    if (tx[key] == '') { delete tx[key]; }
                });
                if (tx.creates == null && tx.contractAddress != null) {
                    tx.creates = tx.contractAddress;
                }
                output.push(Provider._formatters.checkTransactionResponse(tx));
            });
            return output;
        });
    });
});

module.exports = EtherscanProvider;;

},{"./provider.js":12,"ethers-utils/convert.js":18,"ethers-utils/properties.js":23}],6:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var Provider = require('./provider.js');

var utils = (function() {
    return {
        defineProperty: require('ethers-utils/properties.js').defineProperty,
    };
})();


function FallbackProvider(providers) {
    if (providers.length === 0) { throw new Error('no providers'); }

    var network = {};
    ['chainId', 'ensAddress', 'name', 'testnet'].forEach(function(key) {
        for (var i = 1; i < providers.length; i++) {
            if (providers[0][key] !== providers[i][key]) {
                throw new Error('incompatible providers - ' + key + ' mismatch');
            }
        }
        network[key] = providers[0][key];
    });

    if (!(this instanceof FallbackProvider)) { throw new Error('missing new'); }
    Provider.call(this, network);

    providers = providers.slice(0);
    Object.defineProperty(this, 'providers', {
        get: function() {
            return providers.slice(0);
        }
    });
}
inherits(FallbackProvider, Provider);


utils.defineProperty(FallbackProvider.prototype, 'perform', function(method, params) {
    var providers = this.providers;
    return new Promise(function(resolve, reject) {
        var firstError = null;
        function next() {
            if (!providers.length) {
                reject(firstError);
                return;
            }

            var provider = providers.shift();
            provider.perform(method, params).then(function(result) {
                resolve(result);
            }, function (error) {
                if (!firstError) { firstError = error; }
                next();
            });
        }
        next();
    });
});

module.exports = FallbackProvider;

},{"./provider.js":12,"ethers-utils/properties.js":23,"inherits":11}],7:[function(require,module,exports){
'use strict';

var Provider = require('./provider.js');

var EtherscanProvider = require('./etherscan-provider.js');
var FallbackProvider = require('./fallback-provider.js');
var InfuraProvider = require('./infura-provider.js');
var JsonRpcProvider = require('./json-rpc-provider.js');
var Web3Provider = require('./web3-provider.js');

function getDefaultProvider(network) {
    return new FallbackProvider([
        new InfuraProvider(network),
        new EtherscanProvider(network),
    ]);
}

module.exports = {
    EtherscanProvider: EtherscanProvider,
    FallbackProvider: FallbackProvider,
    InfuraProvider: InfuraProvider,
    JsonRpcProvider: JsonRpcProvider,
    Web3Provider: Web3Provider,

    isProvider: Provider.isProvider,

    networks: Provider.networks,

    getDefaultProvider:getDefaultProvider,

    Provider: Provider,
}

require('ethers-utils/standalone.js')({
    providers: module.exports
});


},{"./etherscan-provider.js":5,"./fallback-provider.js":6,"./infura-provider.js":8,"./json-rpc-provider.js":9,"./provider.js":12,"./web3-provider.js":13,"ethers-utils/standalone.js":27}],8:[function(require,module,exports){
'use strict';

var Provider = require('./provider');
var JsonRpcProvider = require('./json-rpc-provider');

var utils = (function() {
    return {
        defineProperty: require('ethers-utils/properties.js').defineProperty
    }
})();

function InfuraProvider(network, apiAccessToken) {
    if (!(this instanceof InfuraProvider)) { throw new Error('missing new'); }

    // Legacy constructor (testnet, apiAccessToken)
    // @TODO: Remove this in the next major release
    network = Provider._legacyConstructor(network, 1, arguments[0]);

    var host = null;
    switch(network.name) {
        case 'homestead':
            host = 'mainnet.infura.io';
            break;
        case 'ropsten':
            host = 'ropsten.infura.io';
            break;
        case 'rinkeby':
            host = 'rinkeby.infura.io';
            break;
        case 'kovan':
            host = 'kovan.infura.io';
            break;
        default:
            throw new Error('unsupported network');
    }

    var url = 'https://' + host + '/' + (apiAccessToken || '');

    JsonRpcProvider.call(this, url, network);

    utils.defineProperty(this, 'apiAccessToken', apiAccessToken || null);
}
JsonRpcProvider.inherits(InfuraProvider);

utils.defineProperty(InfuraProvider.prototype, '_startPending', function() {
    console.log('WARNING: INFURA does not support pending filters');
});

utils.defineProperty(InfuraProvider.prototype, '_stopPending', function() {
});

module.exports = InfuraProvider;

},{"./json-rpc-provider":9,"./provider":12,"ethers-utils/properties.js":23}],9:[function(require,module,exports){
'use strict';

// See: https://github.com/ethereum/wiki/wiki/JSON-RPC

var Provider = require('./provider.js');

var utils = (function() {
    var convert = require('ethers-utils/convert');
    return {
        defineProperty: require('ethers-utils/properties').defineProperty,

        hexlify: convert.hexlify,
        isHexString: convert.isHexString,
    }
})();

// @TODO: Move this to utils
function timer(timeout) {
    return new Promise(function(resolve) {
        setTimeout(function() {
            resolve();
        }, timeout);
    });
}

function getResult(payload) {
    if (payload.error) {
        var error = new Error(payload.error.message);
        error.code = payload.error.code;
        error.data = payload.error.data;
        throw error;
    }

    return payload.result;
}

function stripHexZeros(value) {
    while (value.length > 3 && value.substring(0, 3) === '0x0') {
        value = '0x' + value.substring(3);
    }
    return value;
}

function getTransaction(transaction) {
    var result = {};

    for (var key in transaction) {
        result[key] = utils.hexlify(transaction[key]);
    }

    // Some nodes (INFURA ropsten; INFURA mainnet is fine) don't like extra zeros.
    ['gasLimit', 'gasPrice', 'nonce', 'value'].forEach(function(key) {
        if (!result[key]) { return; }
        result[key] = stripHexZeros(result[key]);
    });

    // Transform "gasLimit" to "gas"
    if (result.gasLimit != null && result.gas == null) {
        result.gas = result.gasLimit;
        delete result.gasLimit;
    }

    return result;
}

function JsonRpcProvider(url, network) {
    if (!(this instanceof JsonRpcProvider)) { throw new Error('missing new'); }

    // Legacy Contructor (url, [ testnet, [ chainId ] ])
    // @TODO: Remove this in the next major version

    var args = [];

    // Legacy without a url
    if (typeof(url) !== 'string' || Provider.networks[url] != null) {
        // url => network
        args.push(url);

        // network => chainId
        if (network != null) { args.push(network); }

        url = null;

    } else if (arguments.length === 2) {
        args.push(arguments[1]);

    } else if (arguments.length === 3) {
        args.push(arguments[1]);
        args.push(arguments[2]);
    }

    Provider.apply(this, args);

    if (!url) { url = 'http://localhost:8545'; }

    utils.defineProperty(this, 'url', url);
}
Provider.inherits(JsonRpcProvider);

utils.defineProperty(JsonRpcProvider.prototype, 'send', function(method, params) {
    var request = {
        method: method,
        params: params,
        id: 42,
        jsonrpc: "2.0"
    };
    return Provider.fetchJSON(this.url, JSON.stringify(request), getResult);
});

utils.defineProperty(JsonRpcProvider.prototype, 'perform', function(method, params) {
    switch (method) {
        case 'getBlockNumber':
            return this.send('eth_blockNumber', []);

        case 'getGasPrice':
            return this.send('eth_gasPrice', []);

        case 'getBalance':
            var blockTag = params.blockTag;
            if (utils.isHexString(blockTag)) { blockTag = stripHexZeros(blockTag); }
            return this.send('eth_getBalance', [params.address, blockTag]);

        case 'getTransactionCount':
            var blockTag = params.blockTag;
            if (utils.isHexString(blockTag)) { blockTag = stripHexZeros(blockTag); }
            return this.send('eth_getTransactionCount', [params.address, blockTag]);

        case 'getCode':
            var blockTag = params.blockTag;
            if (utils.isHexString(blockTag)) { blockTag = stripHexZeros(blockTag); }
            return this.send('eth_getCode', [params.address, blockTag]);

        case 'getStorageAt':
            var position = params.position;
            if (utils.isHexString(position)) { position = stripHexZeros(position); }
            var blockTag = params.blockTag;
            if (utils.isHexString(blockTag)) { blockTag = stripHexZeros(blockTag); }
            return this.send('eth_getStorageAt', [params.address, position, blockTag]);

        case 'sendTransaction':
            return this.send('eth_sendRawTransaction', [params.signedTransaction]);

        case 'getBlock':
            if (params.blockTag) {
                var blockTag = params.blockTag;
                if (utils.isHexString(blockTag)) { blockTag = stripHexZeros(blockTag); }
                return this.send('eth_getBlockByNumber', [blockTag, false]);
            } else if (params.blockHash) {
                return this.send('eth_getBlockByHash', [params.blockHash, false]);
            }
            return Promise.reject(new Error('invalid block tag or block hash'));

        case 'getTransaction':
            return this.send('eth_getTransactionByHash', [params.transactionHash]);

        case 'getTransactionReceipt':
            return this.send('eth_getTransactionReceipt', [params.transactionHash]);

        case 'call':
            return this.send('eth_call', [getTransaction(params.transaction), 'latest']);

        case 'estimateGas':
            return this.send('eth_estimateGas', [getTransaction(params.transaction)]);

        case 'getLogs':
            return this.send('eth_getLogs', [params.filter]);

        default:
            break;
    }

    return Promise.reject(new Error('not implemented - ' + method));
});

utils.defineProperty(JsonRpcProvider.prototype, '_startPending', function() {
    if (this._pendingFilter != null) { return; }
    var self = this;

    var pendingFilter = this.send('eth_newPendingTransactionFilter', []);
    this._pendingFilter = pendingFilter;

    pendingFilter.then(function(filterId) {
        function poll() {
            self.send('eth_getFilterChanges', [ filterId ]).then(function(hashes) {
                if (self._pendingFilter != pendingFilter) { return; }

                var seq = Promise.resolve();
                hashes.forEach(function(hash) {
                    seq = seq.then(function() {
                        return self.getTransaction(hash).then(function(tx) {
                            self.emit('pending', tx);
                        });
                    });
                });

                return seq.then(function() {
                    return timer(1000);
                });
            }).then(function() {
                if (self._pendingFilter != pendingFilter) {
                    self.send('eth_uninstallFilter', [ filterIf ]);
                    return;
                }
                setTimeout(function() { poll(); }, 0);
            });
        }
        poll();

        return filterId;
    });
});

utils.defineProperty(JsonRpcProvider.prototype, '_stopPending', function() {
    this._pendingFilter = null;
});

utils.defineProperty(JsonRpcProvider, '_hexlifyTransaction', function(transaction) {
    return getTransaction(transaction);
});

module.exports = JsonRpcProvider;

},{"./provider.js":12,"ethers-utils/convert":18,"ethers-utils/properties":23}],10:[function(require,module,exports){
module.exports={
    "unspecified": {
        "chainId": 0,
        "name": "unspecified"
    },

    "homestead": {
        "chainId": 1,
        "ensAddress": "0x314159265dd8dbb310642f98f50c066173c1259b",
        "name": "homestead"
    },
    "mainnet": {
        "chainId": 1,
        "ensAddress": "0x314159265dd8dbb310642f98f50c066173c1259b",
        "name": "homestead"
    },

    "morden": {
        "chainId": 2,
        "name": "morden"
    },

    "ropsten": {
        "chainId": 3,
        "ensAddress": "0x112234455c3a32fd11230c42e7bccd4a84e02010",
        "name": "ropsten"
    },
    "testnet": {
        "chainId": 3,
        "ensAddress": "0x112234455c3a32fd11230c42e7bccd4a84e02010",
        "name": "ropsten"
    },

    "rinkeby": {
        "chainId": 4,
        "name": "rinkeby"
    },
    "kovan": {
        "chainId": 42,
        "name": "kovan"
    }
}

},{}],11:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],12:[function(require,module,exports){
'use strict';

var inherits = require('inherits');

var XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

var networks = require('./networks.json');

var utils = (function() {
    var convert = require('ethers-utils/convert');
    return {
        defineProperty: require('ethers-utils/properties').defineProperty,

        getAddress: require('ethers-utils/address').getAddress,
        getContractAddress: require('ethers-utils/contract-address').getContractAddress,

        bigNumberify: require('ethers-utils/bignumber').bigNumberify,
        arrayify: convert.arrayify,

        hexlify: convert.hexlify,
        isHexString: convert.isHexString,

        concat: convert.concat,
        stripZeros: convert.stripZeros,

        namehash: require('ethers-utils/namehash'),

        toUtf8String: require('ethers-utils/utf8').toUtf8String,

        RLP: require('ethers-utils/rlp'),
    }
})();

function copyObject(obj) {
    var result = {};
    for (var key in obj) { result[key] = obj[key]; }
    return result;
}

function check(format, object) {
    var result = {};
    for (var key in format) {
        try {
            var value = format[key](object[key]);
            if (value !== undefined) { result[key] = value; }
        } catch (error) {
            error.checkKey = key;
            error.checkValue = object[key];
            throw error;
        }
    }
    return result;
}

function allowNull(check, nullValue) {
    return (function(value) {
        if (value == null) { return nullValue; }
        return check(value);
    });
}

function allowFalsish(check, replaceValue) {
    return (function(value) {
        if (!value) { return replaceValue; }
        return check(value);
    });
}

function arrayOf(check) {
    return (function(array) {
        if (!Array.isArray(array)) { throw new Error('not an array'); }

        var result = [];

        array.forEach(function(value) {
            result.push(check(value));
        });

        return result;
    });
}

function checkHash(hash) {
    if (!utils.isHexString(hash) || hash.length !== 66) {
        throw new Error('invalid hash - ' + hash);
    }
    return hash;
}

function checkNumber(number) {
    return utils.bigNumberify(number).toNumber();
}

function checkBoolean(value) {
    if (typeof(value) === 'boolean') { return value; }
    if (typeof(value) === 'string') {
        if (value === 'true') { return true; }
        if (value === 'false') { return false; }
    }
    throw new Error('invaid boolean - ' + value);
}

function checkUint256(uint256) {
    if (!utils.isHexString(uint256)) {
        throw new Error('invalid uint256');
    }
    while (uint256.length < 66) {
        uint256 = '0x0' + uint256.substring(2);
    }
    return uint256;
}

function checkString(string) {
    if (typeof(string) !== 'string') { throw new Error('invalid string'); }
    return string;
}

function checkBlockTag(blockTag) {
    if (blockTag == null) { return 'latest'; }

    if (blockTag === 'earliest') { return '0x0'; }

    if (blockTag === 'latest' || blockTag === 'pending') {
        return blockTag;
    }

    if (typeof(blockTag) === 'number') {
        return utils.hexlify(blockTag);
    }

    if (utils.isHexString(blockTag)) { return blockTag; }

    throw new Error('invalid blockTag');
}

var formatBlock = {
    hash: checkHash,
    parentHash: checkHash,
    number: checkNumber,

    timestamp: checkNumber,
    nonce: allowNull(utils.hexlify),
    difficulty: allowNull(checkNumber),

    gasLimit: utils.bigNumberify,
    gasUsed: utils.bigNumberify,

    miner: utils.getAddress,
    extraData: utils.hexlify,

    //transactions: allowNull(arrayOf(checkTransaction)),
    transactions: allowNull(arrayOf(checkHash)),

    //transactionRoot: checkHash,
    //stateRoot: checkHash,
    //sha3Uncles: checkHash,

    //logsBloom: utils.hexlify,
};

function checkBlock(block) {
    if (block.author != null && block.miner == null) {
        block.miner = block.author;
    }
    return check(formatBlock, block);
}


var formatTransaction = {
   hash: checkHash,

   blockHash: allowNull(checkHash, null),
   blockNumber: allowNull(checkNumber, null),
   transactionIndex: allowNull(checkNumber, null),

   from: utils.getAddress,

   gasPrice: utils.bigNumberify,
   gasLimit: utils.bigNumberify,
   to: allowNull(utils.getAddress, null),
   value: utils.bigNumberify,
   nonce: checkNumber,
   data: utils.hexlify,

   r: allowNull(checkUint256),
   s: allowNull(checkUint256),
   v: allowNull(checkNumber),

   creates: allowNull(utils.getAddress, null),

   raw: allowNull(utils.hexlify),
};

function checkTransaction(transaction) {

    // Rename gas to gasLimit
    if (transaction.gas != null && transaction.gasLimit == null) {
        transaction.gasLimit = transaction.gas;
    }

    // Some clients (TestRPC) do strange things like return 0x0 for the
    // 0 address; correct this to be a real address
    if (transaction.to && utils.bigNumberify(transaction.to).isZero()) {
        transaction.to = '0x0000000000000000000000000000000000000000';
    }

    // Rename input to data
    if (transaction.input != null && transaction.data == null) {
        transaction.data = transaction.input;
    }

    // If to and creates are empty, populate the creates from the transaction
    if (transaction.to == null && transaction.creates == null) {
        transaction.creates = utils.getContractAddress(transaction);
    }

    if (!transaction.raw) {
        // Very loose providers (e.g. TestRPC) don't provide a signature or raw
        if (transaction.v && transaction.r && transaction.s) {
            var raw = [
                utils.stripZeros(utils.hexlify(transaction.nonce)),
                utils.stripZeros(utils.hexlify(transaction.gasPrice)),
                utils.stripZeros(utils.hexlify(transaction.gasLimit)),
                (transaction.to || "0x"),
                utils.stripZeros(utils.hexlify(transaction.value || '0x')),
                utils.hexlify(transaction.data || '0x'),
                utils.stripZeros(utils.hexlify(transaction.v || '0x')),
                utils.stripZeros(utils.hexlify(transaction.r)),
                utils.stripZeros(utils.hexlify(transaction.s)),
            ];

            transaction.raw = utils.RLP.encode(raw);
        }
    }


    var result = check(formatTransaction, transaction);

    var networkId = transaction.networkId;

    if (utils.isHexString(networkId)) {
        networkId = utils.bigNumberify(networkId).toNumber();
    }

    if (typeof(networkId) !== 'number' && result.v != null) {
        networkId = (result.v - 35) / 2;
        if (networkId < 0) { networkId = 0; }
        networkId = parseInt(networkId);
    }

    if (typeof(networkId) !== 'number') { networkId = 0; }

    result.networkId = networkId;

    // 0x0000... should actually be null
    if (result.blockHash && result.blockHash.replace(/0/g, '') === 'x') {
        result.blockHash = null;
    }

    return result;
}

var formatTransactionRequest = {
    from: allowNull(utils.getAddress),
    nonce: allowNull(checkNumber),
    gasLimit: allowNull(utils.bigNumberify),
    gasPrice: allowNull(utils.bigNumberify),
    to: allowNull(utils.getAddress),
    value: allowNull(utils.bigNumberify),
    data: allowNull(utils.hexlify),
};

function checkTransactionRequest(transaction) {
    return check(formatTransactionRequest, transaction);
}

var formatTransactionReceiptLog = {
    transactionLogIndex: allowNull(checkNumber),
    transactionIndex: checkNumber,
    blockNumber: checkNumber,
    transactionHash: checkHash,
    address: utils.getAddress,
    // @TODO: Next major release remove this
    type: allowNull(checkString),
    topics: arrayOf(checkHash),
    data: utils.hexlify,
    logIndex: checkNumber,
    blockHash: checkHash,
};

function checkTransactionReceiptLog(log) {
    return check(formatTransactionReceiptLog, log);
}

var formatTransactionReceipt = {
    contractAddress: allowNull(utils.getAddress, null),
    transactionIndex: checkNumber,
    root: allowNull(checkHash),
    gasUsed: utils.bigNumberify,
    logsBloom: utils.hexlify,
    blockHash: checkHash,
    transactionHash: checkHash,
    logs: arrayOf(checkTransactionReceiptLog),
    blockNumber: checkNumber,
    cumulativeGasUsed: utils.bigNumberify,
    status: allowNull(checkNumber)
};

function checkTransactionReceipt(transactionReceipt) {
    var status = transactionReceipt.status;
    var root = transactionReceipt.root;

    var result = check(formatTransactionReceipt, transactionReceipt);
    result.logs.forEach(function(entry, index) {
        if (entry.transactionLogIndex == null) {
            entry.transactionLogIndex = index;
        }
        // @TODO: Remove this is next major version
        if (entry.type == null) {
            entry.type = 'mined';
        }
    });
    if (transactionReceipt.status != null) {
        result.byzantium = true;
    }
    return result;
}

function checkTopics(topics) {
    if (Array.isArray(topics)) {
        topics.forEach(function(topic) {
            checkTopics(topic);
        });

    } else if (topics != null) {
        checkHash(topics);
    }

    return topics;
}

var formatFilter = {
    fromBlock: allowNull(checkBlockTag, undefined),
    toBlock: allowNull(checkBlockTag, undefined),
    address: allowNull(utils.getAddress, undefined),
    topics: allowNull(checkTopics, undefined),
};

function checkFilter(filter) {
    return check(formatFilter, filter);
}

var formatLog = {
    blockNumber: allowNull(checkNumber),
    blockHash: allowNull(checkHash),
    transactionIndex: checkNumber,

    removed: allowNull(checkBoolean),

    address: utils.getAddress,
    data: allowFalsish(utils.hexlify, '0x'),

    topics: arrayOf(checkHash),

    transactionHash: checkHash,
    logIndex: checkNumber,
}

function checkLog(log) {
    return check(formatLog, log);
}

function Provider(network) {
    if (!(this instanceof Provider)) { throw new Error('missing new'); }

    network = Provider._legacyConstructor(network, arguments.length, arguments[0], arguments[1]);

    // Check the ensAddress (if any)
    var ensAddress = null;
    if (network.ensAddress) {
        ensAddress = utils.getAddress(network.ensAddress);
    }

    // Setup our network properties
    utils.defineProperty(this, 'chainId', network.chainId);
    utils.defineProperty(this, 'ensAddress', ensAddress);
    utils.defineProperty(this, 'name', network.name);

    // @TODO: Remove in the next major release
    utils.defineProperty(this, 'testnet', (network.name !== 'homestead'));

    var events = {};
    utils.defineProperty(this, '_events', events);

    var self = this;

    var lastBlockNumber = null;

    var balances = {};

    function doPoll() {
        self.getBlockNumber().then(function(blockNumber) {

            // If the block hasn't changed, meh.
            if (blockNumber === lastBlockNumber) { return; }

            if (lastBlockNumber === null) { lastBlockNumber = blockNumber - 1; }

            // Notify all listener for each block that has passed
            for (var i = lastBlockNumber + 1; i <= blockNumber; i++) {
                self.emit('block', i);
            }

            // Sweep balances and remove addresses we no longer have events for
            var newBalances = {};

            // Find all transaction hashes we are waiting on
            Object.keys(events).forEach(function(eventName) {
                var event = parseEventString(eventName);

                if (event.type === 'transaction') {
                    self.getTransaction(event.hash).then(function(transaction) {
                        if (!transaction || !transaction.blockNumber) { return; }
                        self.emit(event.hash, transaction);
                    });

                } else if (event.type === 'address') {
                    if (balances[event.address]) {
                        newBalances[event.address] = balances[event.address];
                    }
                    self.getBalance(event.address, 'latest').then(function(balance) {
                        var lastBalance = balances[event.address];
                        if (lastBalance && balance.eq(lastBalance)) { return; }
                        balances[event.address] = balance;
                        self.emit(event.address, balance);
                    });

                } else if (event.type === 'topic') {
                    self.getLogs({
                        fromBlock: lastBlockNumber + 1,
                        toBlock: blockNumber,
                        topics: event.topic
                    }).then(function(logs) {
                        if (logs.length === 0) { return; }
                        logs.forEach(function(log) {
                            self.emit(event.topic, log);
                        });
                    });
                }
            });

            lastBlockNumber = blockNumber;

            balances = newBalances;
        });

        self.doPoll();
    }

    utils.defineProperty(this, 'resetEventsBlock', function(blockNumber) {
        lastBlockNumber = blockNumber;
        self.doPoll();
    });

    var poller = null;
    Object.defineProperty(this, 'polling', {
        get: function() { return (poller != null); },
        set: function(value) {
            setTimeout(function() {
                if (value && !poller) {
                    poller = setInterval(doPoll, 4000);

                } else if (!value && poller) {
                    clearInterval(poller);
                    poller = null;
                }
            }, 0);
        }
    });
}

function inheritable(parent) {
    return function(child) {
        inherits(child, parent);
        utils.defineProperty(child, 'inherits', inheritable(child));
    }
}

utils.defineProperty(Provider, 'inherits', inheritable(Provider));
/*
function(child) {
    inherits(child, Provider);
    child.inherits = function(grandchild) {
        inherits(grandchild, child)
    }
});
*/

utils.defineProperty(Provider, '_legacyConstructor', function(network, length, arg0, arg1) {

    // Legacy parameters Provider(testnet:boolean, chainId:Number)
    if (typeof(arg0) === 'boolean' || length === 2) {
        var testnet = !!arg0;
        var chainId = arg1;

        // true => testnet, false => mainnet
        network = networks[testnet ? 'ropsten': 'homestead'];

        // Overriding chain ID
        if (length === 2 && chainId != null) {
            network = {
                chainId: chainId,
                ensAddress: network.ensAddress,
                name: network.name
            };
        }

    } else if (typeof(network) === 'string') {
        network = networks[network];
        if (!network) { throw new Error('unknown network'); }

    } else if (network == null) {
        network = networks['homestead'];
    }

    if (typeof(network.chainId) !== 'number') { throw new Error('invalid chainId'); }

    return network;
});
// @TODO: Remove in next major version (use networks instead)
utils.defineProperty(Provider, 'chainId', {
    homestead: 1,
    morden: 2,
    ropsten: 3,
    rinkeby: 4,
    kovan: 42
});

//utils.defineProperty(Provider, 'isProvider', function(object) {
//    return (object instanceof Provider);
//});

utils.defineProperty(Provider, 'networks', networks);

utils.defineProperty(Provider, 'fetchJSON', function(url, json, processFunc) {

    return new Promise(function(resolve, reject) {
        var request = new XMLHttpRequest();

        if (json) {
            request.open('POST', url, true);
            request.setRequestHeader('Content-Type','application/json');
        } else {
            request.open('GET', url, true);
        }

        request.onreadystatechange = function() {
            if (request.readyState !== 4) { return; }

            try {
                var result = JSON.parse(request.responseText);
            } catch (error) {
                var jsonError = new Error('invalid json response');
                jsonError.orginialError = error;
                jsonError.responseText = request.responseText;
                reject(jsonError);
                return;
            }

            if (processFunc) {
                try {
                    result = processFunc(result);
                } catch (error) {
                    error.url = url;
                    error.body = json;
                    error.responseText = request.responseText;
                    reject(error);
                    return;
                }
            }

            if (request.status != 200) {
                var error = new Error('invalid response - ' + request.status);
                error.statusCode = request.statusCode;
                reject(error);
                return;
            }

            resolve(result);
        };

        request.onerror = function(error) {
            reject(error);
        }

        try {
            if (json) {
                request.send(json);
            } else {
                request.send();
            }

        } catch (error) {
            var connectionError = new Error('connection error');
            connectionError.error = error;
            reject(connectionError);
        }
    });
});


utils.defineProperty(Provider.prototype, 'waitForTransaction', function(transactionHash, timeout) {
    var self = this;
    return new Promise(function(resolve, reject) {
        var timer = null;

        function complete(transaction) {
            if (timer) { clearTimeout(timer); }
            resolve(transaction);
        }

        self.once(transactionHash, complete);

        if (typeof(timeout) === 'number' && timeout > 0) {
            timer = setTimeout(function() {
                self.removeListener(transactionHash, complete);
                reject(new Error('timeout'));
            }, timeout);
        }

    });
});


utils.defineProperty(Provider.prototype, 'getBlockNumber', function() {
    try {
        return this.perform('getBlockNumber').then(function(result) {
            var value = parseInt(result);
            if (value != result) { throw new Error('invalid response - getBlockNumber'); }
            return value;
        });
    } catch (error) {
        return Promise.reject(error);
    }
});

utils.defineProperty(Provider.prototype, 'getGasPrice', function() {
    try {
        return this.perform('getGasPrice').then(function(result) {
            return utils.bigNumberify(result);
        });
    } catch (error) {
        return Promise.reject(error);
    }
});


utils.defineProperty(Provider.prototype, 'getBalance', function(addressOrName, blockTag) {
    var self = this;
    return this.resolveName(addressOrName).then(function(address) {
        var params = { address: address, blockTag: checkBlockTag(blockTag) };
        return self.perform('getBalance', params).then(function(result) {
            return utils.bigNumberify(result);
        });
    });
});

utils.defineProperty(Provider.prototype, 'getTransactionCount', function(addressOrName, blockTag) {
    var self = this;
    return this.resolveName(addressOrName).then(function(address) {
        var params = { address: address, blockTag: checkBlockTag(blockTag) };
        return self.perform('getTransactionCount', params).then(function(result) {
            var value = parseInt(result);
            if (value != result) { throw new Error('invalid response - getTransactionCount'); }
            return value;
        });
    });
});

utils.defineProperty(Provider.prototype, 'getCode', function(addressOrName, blockTag) {
    var self = this;
    return this.resolveName(addressOrName).then(function(address) {
        var params = {address: address, blockTag: checkBlockTag(blockTag)};
        return self.perform('getCode', params).then(function(result) {
            return utils.hexlify(result);
        });
    });
});

utils.defineProperty(Provider.prototype, 'getStorageAt', function(addressOrName, position, blockTag) {
    var self = this;
    return this.resolveName(addressOrName).then(function(address) {
        var params = {
            address: address,
            blockTag: checkBlockTag(blockTag),
            position: utils.hexlify(position),
        };
        return self.perform('getStorageAt', params).then(function(result) {
            return utils.hexlify(result);
        });
    });
});

utils.defineProperty(Provider.prototype, 'sendTransaction', function(signedTransaction) {
    try {
        var params = {signedTransaction: utils.hexlify(signedTransaction)};
        return this.perform('sendTransaction', params).then(function(result) {
            result = utils.hexlify(result);
            if (result.length !== 66) { throw new Error('invalid response - sendTransaction'); }
            return result;
        });
    } catch (error) {
        return Promise.reject(error);
    }
});


utils.defineProperty(Provider.prototype, 'call', function(transaction) {
    var self = this;
    return this._resolveNames(transaction, [ 'to', 'from' ]).then(function(transaction) {
        var params = { transaction: checkTransactionRequest(transaction) };
        return self.perform('call', params).then(function(result) {
            return utils.hexlify(result);
        });
    });
});

utils.defineProperty(Provider.prototype, 'estimateGas', function(transaction) {
    var self = this;
    return this._resolveNames(transaction, [ 'to', 'from' ]).then(function(transaction) {
        var params = {transaction: checkTransactionRequest(transaction)};
        return self.perform('estimateGas', params).then(function(result) {
             return utils.bigNumberify(result);
        });
    });
});


utils.defineProperty(Provider.prototype, 'getBlock', function(blockHashOrBlockTag) {
    try {
        var blockHash = utils.hexlify(blockHashOrBlockTag);
        if (blockHash.length === 66) {
            return this.perform('getBlock', {blockHash: blockHash}).then(function(block) {
                if (block == null) { return null; }
                return checkBlock(block);
            });
        }
    } catch (error) {
        console.log('DEBUG', error);
    }

    try {
        var blockTag = checkBlockTag(blockHashOrBlockTag);
        return this.perform('getBlock', {blockTag: blockTag}).then(function(block) {
            if (block == null) { return null; }
            return checkBlock(block);
        });
    } catch (error) {
        console.log('DEBUG', error);
    }

    return Promise.reject(new Error('invalid block hash or block tag'));
});

utils.defineProperty(Provider.prototype, 'getTransaction', function(transactionHash) {
    try {
        var params = { transactionHash: checkHash(transactionHash) };
        return this.perform('getTransaction', params).then(function(result) {
            if (result != null) { result = checkTransaction(result); }
            return result;
        });
    } catch (error) {
        return Promise.reject(error);
    }
});

utils.defineProperty(Provider.prototype, 'getTransactionReceipt', function(transactionHash) {
    try {
        var params = { transactionHash: checkHash(transactionHash) };
        return this.perform('getTransactionReceipt', params).then(function(result) {
            if (result != null) { result = checkTransactionReceipt(result); }
            return result;
        });
    } catch (error) {
        return Promise.reject(error);
    }
});

utils.defineProperty(Provider.prototype, 'getLogs', function(filter) {
    var self = this;
    return this._resolveNames(filter, ['address']).then(function(filter) {
        var params = { filter: checkFilter(filter) };
        return self.perform('getLogs', params).then(function(result) {
            return arrayOf(checkLog)(result);
        });
    });
});

utils.defineProperty(Provider.prototype, 'getEtherPrice', function() {
    try {
        return this.perform('getEtherPrice', {}).then(function(result) {
            // @TODO: Check valid float
            return result;
        });
    } catch (error) {
        return Promise.reject(error);
    }
});


utils.defineProperty(Provider.prototype, '_resolveNames', function(object, keys) {
    var promises = [];

    var result = copyObject(object);

    keys.forEach(function(key) {
        if (result[key] === undefined) { return; }
        promises.push(this.resolveName(result[key]).then(function(address) {
            result[key] = address;
        }));
    }, this);

    return Promise.all(promises).then(function() { return result; });
});

utils.defineProperty(Provider.prototype, '_getResolver', function(name) {
    var nodeHash = utils.namehash(name);

    // keccak256('resolver(bytes32)')
    var data = '0x0178b8bf' + nodeHash.substring(2);
    var transaction = { to: this.ensAddress, data: data };

    // Get the resolver from the blockchain
    return this.call(transaction).then(function(data) {

        // extract the address from the data
        if (data.length != 66) { return null; }
        return utils.getAddress('0x' + data.substring(26));
    });
});

utils.defineProperty(Provider.prototype, 'resolveName', function(name) {
    // If it is already an address, nothing to resolve
    try {
        return Promise.resolve(utils.getAddress(name));
    } catch (error) { }

    if (!this.ensAddress) { throw new Error('network does not have ENS deployed'); }

    var self = this;

    var nodeHash = utils.namehash(name);

    // Get the addr from the resovler
    return this._getResolver(name).then(function(resolverAddress) {

        // keccak256('addr(bytes32)')
        var data = '0x3b3b57de' + nodeHash.substring(2);
        var transaction = { to: resolverAddress, data: data };
        return self.call(transaction);

    // extract the address from the data
    }).then(function(data) {
        if (data.length != 66) { return null; }
        var address = utils.getAddress('0x' + data.substring(26));
        if (address === '0x0000000000000000000000000000000000000000') { return null; }
        return address;
    });
});

utils.defineProperty(Provider.prototype, 'lookupAddress', function(address) {
    if (!this.ensAddress) { throw new Error('network does not have ENS deployed'); }

    address = utils.getAddress(address);

    var name = address.substring(2) + '.addr.reverse'
    var nodehash = utils.namehash(name);

    var self = this;

    return this._getResolver(name).then(function(resolverAddress) {
        if (!resolverAddress) { return null; }

        // keccak('name(bytes32)')
        var data = '0x691f3431' + nodehash.substring(2);
        var transaction = { to: resolverAddress, data: data };
        return self.call(transaction);

    }).then(function(data) {
        // Strip off the "0x"
        data = data.substring(2);

        // Strip off the dynamic string pointer (0x20)
        if (data.length < 64) { return null; }
        data = data.substring(64);

        if (data.length < 64) { return null; }
        var length = utils.bigNumberify('0x' + data.substring(0, 64)).toNumber();
        data = data.substring(64);

        if (2 * length > data.length) { return null; }

        var name = utils.toUtf8String('0x' + data.substring(0, 2 * length));

        // Make sure the reverse record matches the foward record
        return self.resolveName(name).then(function(addr) {
            if (addr != address) { return null; }
            return name;
        });

    });
});

utils.defineProperty(Provider.prototype, 'doPoll', function() {
});

utils.defineProperty(Provider.prototype, 'perform', function(method, params) {
    return Promise.reject(new Error('not implemented - ' + method));
});

function recurse(object, convertFunc) {
    if (Array.isArray(object)) {
        var result = [];
        object.forEach(function(object) {
            result.push(recurse(object, convertFunc));
        });
        return result;
    }
    return convertFunc(object);
}

function getEventString(object) {
    try {
        return 'address:' + utils.getAddress(object);
    } catch (error) { }

    if (object === 'block') {
        return 'block';

    } else if (object === 'pending') {
        return 'pending';

    } else if (utils.isHexString(object)) {
        if (object.length === 66) {
            return 'tx:' + object;
        }
    } else if (Array.isArray(object)) {
        object = recurse(object, function(object) {
            if (object == null) { object = '0x'; }
            return object;
        });

        try {
            return 'topic:' + utils.RLP.encode(object);
        } catch (error) {
            console.log(error);
        }
    }

    throw new Error('invalid event - ' + object);
}

function parseEventString(string) {
    if (string.substring(0, 3) === 'tx:') {
        return {type: 'transaction', hash: string.substring(3)};

    } else if (string === 'block') {
        return {type: 'block'};

    } else if (string === 'pending') {
        return {type: 'pending'};

    } else if (string.substring(0, 8) === 'address:') {
        return {type: 'address', address: string.substring(8)};

    } else if (string.substring(0, 6) === 'topic:') {
        try {
            var object = utils.RLP.decode(string.substring(6));
            object = recurse(object, function(object) {
                if (object === '0x') { object = null; }
                return object;
            });
            return {type: 'topic', topic: object};
        } catch (error) {
            console.log(error);
        }
    }

    throw new Error('invalid event string');
}

utils.defineProperty(Provider.prototype, '_startPending', function() {
    console.log('WARNING: this provider does not support pending events');
});

utils.defineProperty(Provider.prototype, '_stopPending', function() {
});

utils.defineProperty(Provider.prototype, 'on', function(eventName, listener) {
    var key = getEventString(eventName);
    if (!this._events[key]) { this._events[key] = []; }
    this._events[key].push({eventName: eventName, listener: listener, type: 'on'});
    if (key === 'pending') { this._startPending(); }
    this.polling = true;
});

utils.defineProperty(Provider.prototype, 'once', function(eventName, listener) {
    var key = getEventString(eventName);
    if (!this._events[key]) { this._events[key] = []; }
    this._events[key].push({eventName: eventName, listener: listener, type: 'once'});
    if (key === 'pending') { this._startPending(); }
    this.polling = true;
});

utils.defineProperty(Provider.prototype, 'emit', function(eventName) {
    var key = getEventString(eventName);

    var args = Array.prototype.slice.call(arguments, 1);
    var listeners = this._events[key];
    if (!listeners) { return; }

    for (var i = 0; i < listeners.length; i++) {
        var listener = listeners[i];
        if (listener.type === 'once') {
            listeners.splice(i, 1);
            i--;
        }

        try {
            listener.listener.apply(this, args);
        } catch (error) {
            console.log('Event Listener Error: ' + error.message);
        }
    }

    if (listeners.length === 0) {
        delete this._events[key];
        if (key === 'pending') { this._stopPending(); }
    }

    if (this.listenerCount() === 0) { this.polling = false; }
});

utils.defineProperty(Provider.prototype, 'listenerCount', function(eventName) {
    if (!eventName) {
        var result = 0;
        for (var key in this._events) {
            result += this._events[key].length;
        }
        return result;
    }

    var listeners = this._events[getEventString(eventName)];
    if (!listeners) { return 0; }
    return listeners.length;
});

utils.defineProperty(Provider.prototype, 'listeners', function(eventName) {
    var listeners = this._events[getEventString(eventName)];
    if (!listeners) { return 0; }
    var result = [];
    for (var i = 0; i < listeners.length; i++) {
        result.push(listeners[i].listener);
    }
    return result;
});

utils.defineProperty(Provider.prototype, 'removeAllListeners', function(eventName) {
    delete this._events[getEventString(eventName)];
    if (this.listenerCount() === 0) { this.polling = false; }
});

utils.defineProperty(Provider.prototype, 'removeListener', function(eventName, listener) {
    var listeners = this._events[getEventString(eventName)];
    if (!listeners) { return 0; }
    for (var i = 0; i < listeners.length; i++) {
        if (listeners[i].listener === listener) {
            listeners.splice(i, 1);
            return;
        }
    }
    if (this.listenerCount() === 0) { this.polling = false; }
});

utils.defineProperty(Provider, '_formatters', {
    checkTransactionResponse: checkTransaction
});

module.exports = Provider;

},{"./networks.json":10,"ethers-utils/address":14,"ethers-utils/bignumber":15,"ethers-utils/contract-address":17,"ethers-utils/convert":18,"ethers-utils/namehash":22,"ethers-utils/properties":23,"ethers-utils/rlp":24,"ethers-utils/utf8":30,"inherits":11,"xmlhttprequest":4}],13:[function(require,module,exports){
'use strict';

var utils = require('ethers-utils');

var Provider = require('./provider');
var JsonRpcProvider = require('./json-rpc-provider');


function Web3Signer(provider, address) {
    if (!(this instanceof Web3Signer)) { throw new Error('missing new'); }
    utils.defineProperty(this, 'provider', provider);

    // Statically attach to a given address
    if (address) {
        utils.defineProperty(this, 'address', address);
        utils.defineProperty(this, '_syncAddress', true);

    } else {
        Object.defineProperty(this, 'address', {
            enumerable: true,
            get: function() {
                throw new Error('unsupported sync operation; use getAddress');
            }
        });
        utils.defineProperty(this, '_syncAddress', false);
    }
}

utils.defineProperty(Web3Signer.prototype, 'getAddress', function() {
    if (this._syncAddress) { return Promise.resolve(this.address); }

    return this.provider.send('eth_accounts', []).then(function(accounts) {
        if (accounts.length === 0) {
            throw new Error('no account');
        }
        return utils.getAddress(accounts[0]);
    });
});

utils.defineProperty(Web3Signer.prototype, 'getBalance', function(blockTag) {
    var provider = this.provider;
    return this.getAddress().then(function(address) {
        return provider.getBalance(address, blockTag);
    });
});

utils.defineProperty(Web3Signer.prototype, 'getTransactionCount', function(blockTag) {
    var provider = this.provider;
    return this.getAddress().then(function(address) {
        return provider.getTransactionCount(address, blockTag);
    });
});

utils.defineProperty(Web3Signer.prototype, 'sendTransaction', function(transaction) {
    var provider = this.provider;
    transaction = JsonRpcProvider._hexlifyTransaction(transaction);
    return this.getAddress().then(function(address) {
        transaction.from = address.toLowerCase();
        return provider.send('eth_sendTransaction', [ transaction ]).then(function(hash) {
            return new Promise(function(resolve, reject) {
                function check() {
                    provider.getTransaction(hash).then(function(transaction) {
                        if (!transaction) {
                            setTimeout(check, 1000);
                            return;
                        }
                        resolve(transaction);
                    });
                }
                check();
            });
        });
    });
});

utils.defineProperty(Web3Signer.prototype, 'signMessage', function(message) {
    var provider = this.provider;

    var data = ((typeof(message) === 'string') ? utils.toUtf8Bytes(message): message);
    return this.getAddress().then(function(address) {

        // https://github.com/ethereum/wiki/wiki/JSON-RPC#eth_sign
        var method = 'eth_sign';
        var params = [ address.toLowerCase(), utils.hexlify(data) ];

        // Metamask complains about eth_sign (and on some versions hangs)
        if (provider._web3Provider.isMetaMask) {
            // https://github.com/ethereum/go-ethereum/wiki/Management-APIs#personal_sign
            method = 'personal_sign';
            params = [ utils.hexlify(data), address.toLowerCase() ];
        }

        return provider.send(method, params);
    });
});

utils.defineProperty(Web3Signer.prototype, 'unlock', function(password) {
    var provider = this.provider;

    return this.getAddress().then(function(address) {
        return provider.send('personal_unlockAccount', [ address.toLowerCase(), password, null ]);
    });
});

/*
@TODO
utils.defineProperty(Web3Signer, 'onchange', {

});
*/

function Web3Provider(web3Provider, network) {
    if (!(this instanceof Web3Provider)) { throw new Error('missing new'); }

    // HTTP has a host; IPC has a path.
    var url = web3Provider.host || web3Provider.path || 'unknown';

    // No need to support legacy parameters since this is post-legacy network
    if (network == null) {
        network = Provider.networks.homestead;
    } else if (typeof(network) === 'string') {
        network = Provider.networks[network];
        if (!network) { throw new Error('invalid network'); }
    }

    JsonRpcProvider.call(this, url, network);
    utils.defineProperty(this, '_web3Provider', web3Provider);
}
JsonRpcProvider.inherits(Web3Provider);

utils.defineProperty(Web3Provider.prototype, 'getSigner', function(address) {
    return new Web3Signer(this, address);
});

utils.defineProperty(Web3Provider.prototype, 'listAccounts', function() {
    return this.send('eth_accounts', []).then(function(accounts) {
        accounts.forEach(function(address, index) {
            accounts[index] = utils.getAddress(address);
        });
        return accounts;
    });
});

utils.defineProperty(Web3Provider.prototype, 'send', function(method, params) {
    var provider = this._web3Provider;
    return new Promise(function(resolve, reject) {
        var request = {
            method: method,
            params: params,
            id: 42,
            jsonrpc: "2.0"
        };
        provider.sendAsync(request, function(error, result) {
            if (error) {
                reject(error);
                return;
            }
            if (result.error) {
                var error = new Error(result.error.message);
                error.code = result.error.code;
                error.data = result.error.data;
                reject(error);
                return;
            }
            resolve(result.result);
        });
    });
});

module.exports = Web3Provider;

},{"./json-rpc-provider":9,"./provider":12,"ethers-utils":20}],14:[function(require,module,exports){

var BN = require('bn.js');

var convert = require('./convert');
var throwError = require('./throw-error');
var keccak256 = require('./keccak256');

function getChecksumAddress(address) {
    if (typeof(address) !== 'string' || !address.match(/^0x[0-9A-Fa-f]{40}$/)) {
        throwError('invalid address', {input: address});
    }

    address = address.toLowerCase();

    var hashed = address.substring(2).split('');
    for (var i = 0; i < hashed.length; i++) {
        hashed[i] = hashed[i].charCodeAt(0);
    }
    hashed = convert.arrayify(keccak256(hashed));

    address = address.substring(2).split('');
    for (var i = 0; i < 40; i += 2) {
        if ((hashed[i >> 1] >> 4) >= 8) {
            address[i] = address[i].toUpperCase();
        }
        if ((hashed[i >> 1] & 0x0f) >= 8) {
            address[i + 1] = address[i + 1].toUpperCase();
        }
    }

    return '0x' + address.join('');
}

// Shims for environments that are missing some required constants and functions
var MAX_SAFE_INTEGER = 0x1fffffffffffff;

function log10(x) {
    if (Math.log10) { return Math.log10(x); }
    return Math.log(x) / Math.LN10;
}


// See: https://en.wikipedia.org/wiki/International_Bank_Account_Number
var ibanChecksum = (function() {

    // Create lookup table
    var ibanLookup = {};
    for (var i = 0; i < 10; i++) { ibanLookup[String(i)] = String(i); }
    for (var i = 0; i < 26; i++) { ibanLookup[String.fromCharCode(65 + i)] = String(10 + i); }

    // How many decimal digits can we process? (for 64-bit float, this is 15)
    var safeDigits = Math.floor(log10(MAX_SAFE_INTEGER));

    return function(address) {
        address = address.toUpperCase();
        address = address.substring(4) + address.substring(0, 2) + '00';

        var expanded = address.split('');
        for (var i = 0; i < expanded.length; i++) {
            expanded[i] = ibanLookup[expanded[i]];
        }
        expanded = expanded.join('');

        // Javascript can handle integers safely up to 15 (decimal) digits
        while (expanded.length >= safeDigits){
            var block = expanded.substring(0, safeDigits);
            expanded = parseInt(block, 10) % 97 + expanded.substring(block.length);
        }

        var checksum = String(98 - (parseInt(expanded, 10) % 97));
        while (checksum.length < 2) { checksum = '0' + checksum; }

        return checksum;
    };
})();

function getAddress(address, icapFormat) {
    var result = null;

    if (typeof(address) !== 'string') {
        throwError('invalid address', {input: address});
    }

    if (address.match(/^(0x)?[0-9a-fA-F]{40}$/)) {

        // Missing the 0x prefix
        if (address.substring(0, 2) !== '0x') { address = '0x' + address; }

        result = getChecksumAddress(address);

        // It is a checksummed address with a bad checksum
        if (address.match(/([A-F].*[a-f])|([a-f].*[A-F])/) && result !== address) {
            throwError('invalid address checksum', { input: address, expected: result });
        }

    // Maybe ICAP? (we only support direct mode)
    } else if (address.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)) {

        // It is an ICAP address with a bad checksum
        if (address.substring(2, 4) !== ibanChecksum(address)) {
            throwError('invalid address icap checksum', { input: address });
        }

        result = (new BN(address.substring(4), 36)).toString(16);
        while (result.length < 40) { result = '0' + result; }
        result = getChecksumAddress('0x' + result);

    } else {
        throwError('invalid address', { input: address });
    }

    if (icapFormat) {
        var base36 = (new BN(result.substring(2), 16)).toString(36).toUpperCase();
        while (base36.length < 30) { base36 = '0' + base36; }
        return 'XE' + ibanChecksum('XE00' + base36) + base36;
    }

    return result;
}


module.exports = {
    getAddress: getAddress,
}

},{"./convert":18,"./keccak256":21,"./throw-error":28,"bn.js":2}],15:[function(require,module,exports){
/**
 *  BigNumber
 *
 *  A wrapper around the BN.js object. In the future we can swap out
 *  the underlying BN.js library for something smaller.
 */

var BN = require('bn.js');

var defineProperty = require('./properties').defineProperty;
var convert = require('./convert');
var throwError = require('./throw-error');

function BigNumber(value) {
    if (!(this instanceof BigNumber)) { throw new Error('missing new'); }

    if (convert.isHexString(value)) {
        if (value == '0x') { value = '0x0'; }
        value = new BN(value.substring(2), 16);
    } else if (typeof(value) === 'string' && value[0] === '-' && convert.isHexString(value.substring(1))) {
        value = (new BN(value.substring(3), 16)).mul(BigNumber.constantNegativeOne._bn);

    } else if (typeof(value) === 'string' && value.match(/^-?[0-9]*$/)) {
        if (value == '') { value = '0'; }
        value = new BN(value);

    } else if (typeof(value) === 'number' && parseInt(value) == value) {
        value = new BN(value);

    } else if (BN.isBN(value)) {
        //value = value

    } else if (isBigNumber(value)) {
        value = value._bn;

    } else if (convert.isArrayish(value)) {
        value = new BN(convert.hexlify(value).substring(2), 16);

    } else {
        throwError('invalid BigNumber value', { input: value });
    }

    defineProperty(this, '_bn', value);
}

defineProperty(BigNumber, 'constantNegativeOne', bigNumberify(-1));
defineProperty(BigNumber, 'constantZero', bigNumberify(0));
defineProperty(BigNumber, 'constantOne', bigNumberify(1));
defineProperty(BigNumber, 'constantTwo', bigNumberify(2));
defineProperty(BigNumber, 'constantWeiPerEther', bigNumberify(new BN('1000000000000000000')));


defineProperty(BigNumber.prototype, 'fromTwos', function(value) {
    return new BigNumber(this._bn.fromTwos(value));
});

defineProperty(BigNumber.prototype, 'toTwos', function(value) {
    return new BigNumber(this._bn.toTwos(value));
});


defineProperty(BigNumber.prototype, 'add', function(other) {
    return new BigNumber(this._bn.add(bigNumberify(other)._bn));
});

defineProperty(BigNumber.prototype, 'sub', function(other) {
    return new BigNumber(this._bn.sub(bigNumberify(other)._bn));
});


defineProperty(BigNumber.prototype, 'div', function(other) {
    return new BigNumber(this._bn.div(bigNumberify(other)._bn));
});

defineProperty(BigNumber.prototype, 'mul', function(other) {
    return new BigNumber(this._bn.mul(bigNumberify(other)._bn));
});

defineProperty(BigNumber.prototype, 'mod', function(other) {
    return new BigNumber(this._bn.mod(bigNumberify(other)._bn));
});

defineProperty(BigNumber.prototype, 'pow', function(other) {
    return new BigNumber(this._bn.pow(bigNumberify(other)._bn));
});


defineProperty(BigNumber.prototype, 'maskn', function(value) {
    return new BigNumber(this._bn.maskn(value));
});



defineProperty(BigNumber.prototype, 'eq', function(other) {
    return this._bn.eq(bigNumberify(other)._bn);
});

defineProperty(BigNumber.prototype, 'lt', function(other) {
    return this._bn.lt(bigNumberify(other)._bn);
});

defineProperty(BigNumber.prototype, 'lte', function(other) {
    return this._bn.lte(bigNumberify(other)._bn);
});

defineProperty(BigNumber.prototype, 'gt', function(other) {
    return this._bn.gt(bigNumberify(other)._bn);
});

defineProperty(BigNumber.prototype, 'gte', function(other) {
    return this._bn.gte(bigNumberify(other)._bn);
});


defineProperty(BigNumber.prototype, 'isZero', function() {
    return this._bn.isZero();
});


defineProperty(BigNumber.prototype, 'toNumber', function(base) {
    return this._bn.toNumber();
});

defineProperty(BigNumber.prototype, 'toString', function() {
    //return this._bn.toString(base || 10);
    return this._bn.toString(10);
});

defineProperty(BigNumber.prototype, 'toHexString', function() {
    var hex = this._bn.toString(16);
    if (hex.length % 2) { hex = '0' + hex; }
    return '0x' + hex;
});


function isBigNumber(value) {
    return (value._bn && value._bn.mod);
}

function bigNumberify(value) {
    if (isBigNumber(value)) { return value; }
    return new BigNumber(value);
}

module.exports = {
    isBigNumber: isBigNumber,
    bigNumberify: bigNumberify,
    BigNumber: BigNumber
};

},{"./convert":18,"./properties":23,"./throw-error":28,"bn.js":2}],16:[function(require,module,exports){
(function (global){
'use strict';

var convert = require('./convert');
var defineProperty = require('./properties').defineProperty;

var crypto = global.crypto || global.msCrypto;
if (!crypto || !crypto.getRandomValues) {

    console.log('WARNING: Missing strong random number source; using weak randomBytes');

    crypto = {
        getRandomValues: function(buffer) {
            for (var round = 0; round < 20; round++) {
                for (var i = 0; i < buffer.length; i++) {
                    if (round) {
                        buffer[i] ^= parseInt(256 * Math.random());
                    } else {
                        buffer[i] = parseInt(256 * Math.random());
                    }
                }
            }

            return buffer;
        },
        _weakCrypto: true
    };
}

function randomBytes(length) {
    if (length <= 0 || length > 1024 || parseInt(length) != length) {
        throw new Error('invalid length');
    }

    var result = new Uint8Array(length);
    crypto.getRandomValues(result);
    return convert.arrayify(result);
};

if (crypto._weakCrypto === true) {
    defineProperty(randomBytes, '_weakCrypto', true);
}

module.exports = randomBytes;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./convert":18,"./properties":23}],17:[function(require,module,exports){

var getAddress = require('./address').getAddress;
var convert = require('./convert');
var keccak256 = require('./keccak256');
var RLP = require('./rlp');

// http://ethereum.stackexchange.com/questions/760/how-is-the-address-of-an-ethereum-contract-computed
function getContractAddress(transaction) {
    if (!transaction.from) { throw new Error('missing from address'); }
    var nonce = transaction.nonce;

    return getAddress('0x' + keccak256(RLP.encode([
        getAddress(transaction.from),
        convert.stripZeros(convert.hexlify(nonce, 'nonce'))
    ])).substring(26));
}

module.exports = {
    getContractAddress: getContractAddress,
}

},{"./address":14,"./convert":18,"./keccak256":21,"./rlp":24}],18:[function(require,module,exports){
/**
 *  Conversion Utilities
 *
 */

var defineProperty = require('./properties.js').defineProperty;
var throwError = require('./throw-error');

function addSlice(array) {
    if (array.slice) { return array; }

    array.slice = function() {
        var args = Array.prototype.slice.call(arguments);
        return new Uint8Array(Array.prototype.slice.apply(array, args));
    }

    return array;
}

function isArrayish(value) {
    if (!value || parseInt(value.length) != value.length || typeof(value) === 'string') {
        return false;
    }

    for (var i = 0; i < value.length; i++) {
        var v = value[i];
        if (v < 0 || v >= 256 || parseInt(v) != v) {
            return false;
        }
    }

    return true;
}

function arrayify(value, name) {

    if (value && value.toHexString) {
        value = value.toHexString();
    }

    if (isHexString(value)) {
        value = value.substring(2);
        if (value.length % 2) { value = '0' + value; }

        var result = [];
        for (var i = 0; i < value.length; i += 2) {
            result.push(parseInt(value.substr(i, 2), 16));
        }

        return addSlice(new Uint8Array(result));
    }

    if (isArrayish(value)) {
        return addSlice(new Uint8Array(value));
    }

    throwError('invalid arrayify value', { name: name, input: value });
}

function concat(objects) {
    var arrays = [];
    var length = 0;
    for (var i = 0; i < objects.length; i++) {
        var object = arrayify(objects[i])
        arrays.push(object);
        length += object.length;
    }

    var result = new Uint8Array(length);
    var offset = 0;
    for (var i = 0; i < arrays.length; i++) {
        result.set(arrays[i], offset);
        offset += arrays[i].length;
    }

    return addSlice(result);
}
function stripZeros(value) {
    value = arrayify(value);

    if (value.length === 0) { return value; }

    // Find the first non-zero entry
    var start = 0;
    while (value[start] === 0) { start++ }

    // If we started with zeros, strip them
    if (start) {
        value = value.slice(start);
    }

    return value;
}

function padZeros(value, length) {
    value = arrayify(value);

    if (length < value.length) { throw new Error('cannot pad'); }

    var result = new Uint8Array(length);
    result.set(value, length - value.length);
    return addSlice(result);
}


function isHexString(value, length) {
    if (typeof(value) !== 'string' || !value.match(/^0x[0-9A-Fa-f]*$/)) {
        return false
    }
    if (length && value.length !== 2 + 2 * length) { return false; }
    return true;
}

var HexCharacters = '0123456789abcdef';

function hexlify(value, name) {

    if (value && value.toHexString) {
        return value.toHexString();
    }

    if (typeof(value) === 'number') {
        if (value < 0) {
            throwError('cannot hexlify negative value', { name: name, input: value });
        }

        var hex = '';
        while (value) {
            hex = HexCharacters[value & 0x0f] + hex;
            value = parseInt(value / 16);
        }

        if (hex.length) {
            if (hex.length % 2) { hex = '0' + hex; }
            return '0x' + hex;
        }

        return '0x00';
    }

    if (isHexString(value)) {
        if (value.length % 2) {
            value = '0x0' + value.substring(2);
        }
        return value;
    }

    if (isArrayish(value)) {
        var result = [];
        for (var i = 0; i < value.length; i++) {
             var v = value[i];
             result.push(HexCharacters[(v & 0xf0) >> 4] + HexCharacters[v & 0x0f]);
        }
        return '0x' + result.join('');
    }

    throwError('invalid hexlify value', { name: name, input: value });
}


module.exports = {
    arrayify: arrayify,
    isArrayish: isArrayish,

    concat: concat,

    padZeros: padZeros,
    stripZeros: stripZeros,

    hexlify: hexlify,
    isHexString: isHexString,
};

},{"./properties.js":23,"./throw-error":28}],19:[function(require,module,exports){
'use strict';

var keccak256 = require('./keccak256');
var utf8 = require('./utf8');

function id(text) {
    return keccak256(utf8.toUtf8Bytes(text));
}

module.exports = id;

},{"./keccak256":21,"./utf8":30}],20:[function(require,module,exports){
'use strict';

// This is SUPER useful, but adds 140kb (even zipped, adds 40kb)
//var unorm = require('unorm');

var address = require('./address');
var bigNumber = require('./bignumber');
var contractAddress = require('./contract-address');
var convert = require('./convert');
var id = require('./id');
var keccak256 = require('./keccak256');
var namehash = require('./namehash');
var sha256 = require('./sha2').sha256;
var solidity = require('./solidity');
var randomBytes = require('./random-bytes');
var properties = require('./properties');
var RLP = require('./rlp');
var utf8 = require('./utf8');
var units = require('./units');


module.exports = {
    RLP: RLP,

    defineProperty: properties.defineProperty,

    // NFKD (decomposed)
    //etherSymbol: '\uD835\uDF63',

    // NFKC (composed)
    etherSymbol: '\u039e',

    arrayify: convert.arrayify,

    concat: convert.concat,
    padZeros: convert.padZeros,
    stripZeros: convert.stripZeros,

    bigNumberify: bigNumber.bigNumberify,
    BigNumber: bigNumber.BigNumber,

    hexlify: convert.hexlify,

    toUtf8Bytes: utf8.toUtf8Bytes,
    toUtf8String: utf8.toUtf8String,

    namehash: namehash,
    id: id,

    getAddress: address.getAddress,
    getContractAddress: contractAddress.getContractAddress,

    formatEther: units.formatEther,
    parseEther: units.parseEther,

    formatUnits: units.formatUnits,
    parseUnits: units.parseUnits,

    keccak256: keccak256,
    sha256: sha256,

    randomBytes: randomBytes,

    solidityPack: solidity.pack,
    solidityKeccak256: solidity.keccak256,
    soliditySha256: solidity.sha256,
}

require('./standalone')({
    utils: module.exports
});


},{"./address":14,"./bignumber":15,"./contract-address":17,"./convert":18,"./id":19,"./keccak256":21,"./namehash":22,"./properties":23,"./random-bytes":16,"./rlp":24,"./sha2":25,"./solidity":26,"./standalone":27,"./units":29,"./utf8":30}],21:[function(require,module,exports){
'use strict';

var sha3 = require('js-sha3');

var convert = require('./convert.js');

function keccak256(data) {
    data = convert.arrayify(data);
    return '0x' + sha3.keccak_256(data);
}

module.exports = keccak256;

},{"./convert.js":18,"js-sha3":47}],22:[function(require,module,exports){
'use strict';

var convert = require('./convert');
var utf8 = require('./utf8');
var keccak256 = require('./keccak256');

var Zeros = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
var Partition = new RegExp("^((.*)\\.)?([^.]+)$");
var UseSTD3ASCIIRules = new RegExp("^[a-z0-9.-]*$");

function namehash(name, depth) {
    name = name.toLowerCase();

    // Supporting the full UTF-8 space requires additional (and large)
    // libraries, so for now we simply do not support them.
    // It should be fairly easy in the future to support systems with
    // String.normalize, but that is future work.
    if (!name.match(UseSTD3ASCIIRules)) {
        throw new Error('contains invalid UseSTD3ASCIIRules characters');
    }

    var result = Zeros;
    var processed = 0;
    while (name.length && (!depth || processed < depth)) {
        var partition = name.match(Partition);
        var label = utf8.toUtf8Bytes(partition[3]);
        result = keccak256(convert.concat([result, keccak256(label)]));

        name = partition[2] || '';

        processed++;
    }

    return convert.hexlify(result);
}

module.exports = namehash;


},{"./convert":18,"./keccak256":21,"./utf8":30}],23:[function(require,module,exports){
'use strict';

function defineProperty(object, name, value) {
    Object.defineProperty(object, name, {
        enumerable: true,
        value: value,
        writable: false,
    });
}

module.exports = {
    defineProperty: defineProperty,
};

},{}],24:[function(require,module,exports){
//See: https://github.com/ethereum/wiki/wiki/RLP

var convert = require('./convert.js');

function arrayifyInteger(value) {
    var result = [];
    while (value) {
        result.unshift(value & 0xff);
        value >>= 8;
    }
    return result;
}

function unarrayifyInteger(data, offset, length) {
    var result = 0;
    for (var i = 0; i < length; i++) {
        result = (result * 256) + data[offset + i];
    }
    return result;
}

function _encode(object) {
    if (Array.isArray(object)) {
        var payload = [];
        object.forEach(function(child) {
            payload = payload.concat(_encode(child));
        });

        if (payload.length <= 55) {
            payload.unshift(0xc0 + payload.length)
            return payload;
        }

        var length = arrayifyInteger(payload.length);
        length.unshift(0xf7 + length.length);

        return length.concat(payload);

    } else {
        object = [].slice.call(convert.arrayify(object));

        if (object.length === 1 && object[0] <= 0x7f) {
            return object;

        } else if (object.length <= 55) {
            object.unshift(0x80 + object.length);
            return object
        }

        var length = arrayifyInteger(object.length);
        length.unshift(0xb7 + length.length);

        return length.concat(object);
    }
}

function encode(object) {
    return convert.hexlify(_encode(object));
}

function _decodeChildren(data, offset, childOffset, length) {
    var result = [];

    while (childOffset < offset + 1 + length) {
        var decoded = _decode(data, childOffset);

        result.push(decoded.result);

        childOffset += decoded.consumed;
        if (childOffset > offset + 1 + length) {
            throw new Error('invalid rlp');
        }
    }

    return {consumed: (1 + length), result: result};
}

// returns { consumed: number, result: Object }
function _decode(data, offset) {
    if (data.length === 0) { throw new Error('invalid rlp data'); }

    // Array with extra length prefix
    if (data[offset] >= 0xf8) {
        var lengthLength = data[offset] - 0xf7;
        if (offset + 1 + lengthLength > data.length) {
            throw new Error('too short');
        }

        var length = unarrayifyInteger(data, offset + 1, lengthLength);
        if (offset + 1 + lengthLength + length > data.length) {
            throw new Error('to short');
        }

        return _decodeChildren(data, offset, offset + 1 + lengthLength, lengthLength + length);

    } else if (data[offset] >= 0xc0) {
        var length = data[offset] - 0xc0;
        if (offset + 1 + length > data.length) {
            throw new Error('invalid rlp data');
        }

        return _decodeChildren(data, offset, offset + 1, length);

    } else if (data[offset] >= 0xb8) {
        var lengthLength = data[offset] - 0xb7;
        if (offset + 1 + lengthLength > data.length) {
            throw new Error('invalid rlp data');
        }

        var length = unarrayifyInteger(data, offset + 1, lengthLength);
        if (offset + 1 + lengthLength + length > data.length) {
            throw new Error('invalid rlp data');
        }

        var result = convert.hexlify(data.slice(offset + 1 + lengthLength, offset + 1 + lengthLength + length));
        return { consumed: (1 + lengthLength + length), result: result }

    } else if (data[offset] >= 0x80) {
        var length = data[offset] - 0x80;
        if (offset + 1 + length > data.offset) {
            throw new Error('invlaid rlp data');
        }

        var result = convert.hexlify(data.slice(offset + 1, offset + 1 + length));
        return { consumed: (1 + length), result: result }
    }
    return { consumed: 1, result: convert.hexlify(data[offset]) };
}

function decode(data) {
    data = convert.arrayify(data);
    var decoded = _decode(data, 0);
    if (decoded.consumed !== data.length) {
        throw new Error('invalid rlp data');
    }
    return decoded.result;
}

module.exports = {
    encode: encode,
    decode: decode,
}

},{"./convert.js":18}],25:[function(require,module,exports){
'use strict';

var hash = require('hash.js');

var convert = require('./convert.js');

function sha256(data) {
    data = convert.arrayify(data);
    return '0x' + (hash.sha256().update(data).digest('hex'));
}

function sha512(data) {
    data = convert.arrayify(data);
    return '0x' + (hash.sha512().update(data).digest('hex'));
}

module.exports = {
    sha256: sha256,
    sha512: sha512,

    createSha256: hash.sha256,
    createSha512: hash.sha512,
}

},{"./convert.js":18,"hash.js":34}],26:[function(require,module,exports){
'use strict';

var bigNumberify = require('./bignumber').bigNumberify;
var convert = require('./convert');
var getAddress = require('./address').getAddress;
var utf8 = require('./utf8');

var hashKeccak256 = require('./keccak256');
var hashSha256 = require('./sha2').sha256;

var regexBytes = new RegExp("^bytes([0-9]+)$");
var regexNumber = new RegExp("^(u?int)([0-9]*)$");
var regexArray = new RegExp("^(.*)\\[([0-9]*)\\]$");

var Zeros = '0000000000000000000000000000000000000000000000000000000000000000';

function _pack(type, value, isArray) {
    switch(type) {
        case 'address':
            if (isArray) { return convert.padZeros(value, 32); }
            return convert.arrayify(value);
        case 'string':
            return utf8.toUtf8Bytes(value);
        case 'bytes':
            return convert.arrayify(value);
        case 'bool':
            value = (value ? '0x01': '0x00');
            if (isArray) { return convert.padZeros(value, 32); }
            return convert.arrayify(value);
    }

    var match =  type.match(regexNumber);
    if (match) {
        var signed = (match[1] === 'int')
        var size = parseInt(match[2] || "256")
        if ((size % 8 != 0) || size === 0 || size > 256) {
            throw new Error('invalid number type - ' + type);
        }

        if (isArray) { size = 256; }

        value = bigNumberify(value).toTwos(size);

        return convert.padZeros(value, size / 8);
    }

    match = type.match(regexBytes);
    if (match) {
        var size = match[1];
        if (size != parseInt(size) || size === 0 || size > 32) {
            throw new Error('invalid number type - ' + type);
        }
        size = parseInt(size);
        if (convert.arrayify(value).byteLength !== size) { throw new Error('invalid value for ' + type); }
        if (isArray) { return (value + Zeros).substring(0, 66); }
        return value;
    }

    match = type.match(regexArray);
    if (match) {
        var baseType = match[1];
        var count = parseInt(match[2] || value.length);
        if (count != value.length) { throw new Error('invalid value for ' + type); }
        var result = [];
        value.forEach(function(value) {
            value = _pack(baseType, value, true);
            result.push(value);
        });
        return convert.concat(result);
    }

    throw new Error('unknown type - ' + type);
}

function pack(types, values) {
    if (types.length != values.length) { throw new Error('type/value count mismatch'); }
    var tight = [];
    types.forEach(function(type, index) {
        tight.push(_pack(type, values[index]));
    });
    return convert.hexlify(convert.concat(tight));
}

function keccak256(types, values) {
    return hashKeccak256(pack(types, values));
}

function sha256(types, values) {
    return hashSha256(pack(types, values));
}

module.exports = {
    pack: pack,

    keccak256: keccak256,
    sha256: sha256,
}

},{"./address":14,"./bignumber":15,"./convert":18,"./keccak256":21,"./sha2":25,"./utf8":30}],27:[function(require,module,exports){
(function (global){
var defineProperty = require('./properties.js').defineProperty;

function Ethers() { }

function defineEthersValues(values) {

    // This is modified in the Gruntfile.js
    if ("__STAND_ALONE_FALSE__" !== ("__STAND_ALONE_" + "TRUE__")) {
        return;
    }

    if (global.ethers == null) {
        defineProperty(global, 'ethers', new Ethers());
    }

    for (var key in values) {
        if (global.ethers[key] == null) {
            defineProperty(global.ethers, key, values[key]);
        }
    }
}

module.exports = defineEthersValues;

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./properties.js":23}],28:[function(require,module,exports){
'use strict';

function throwError(message, params) {
    var error = new Error(message);
    for (var key in params) {
        error[key] = params[key];
    }
    throw error;
}

module.exports = throwError;

},{}],29:[function(require,module,exports){
var bigNumberify = require('./bignumber.js').bigNumberify;
var throwError = require('./throw-error');

var zero = new bigNumberify(0);
var negative1 = new bigNumberify(-1);

var names = [
    'wei',
    'kwei',
    'Mwei',
    'Gwei',
    'szabo',
    'finny',
    'ether',
];

var getUnitInfo = (function() {
    var unitInfos = {};

    var value = '1';
    names.forEach(function(name) {
        var info = {
            decimals: value.length - 1,
            tenPower: bigNumberify(value),
            name: name
        };
        unitInfos[name.toLowerCase()] = info;
        unitInfos[String(info.decimals)] = info;
        value += '000';
    });

    return function(name) {
        return unitInfos[String(name).toLowerCase()];
    }
})();

function formatUnits(value, unitType, options) {
    if (typeof(unitType) === 'object' && !options) {
        options = unitType;
        unitType = undefined;
    }
    if (unitType == null) {  unitType = 18; }

    var unitInfo = getUnitInfo(unitType);

    // Make sure wei is a big number (convert as necessary)
    value = bigNumberify(value);

    if (!options) { options = {}; }

    var negative = value.lt(zero);
    if (negative) { value = value.mul(negative1); }

    var fraction = value.mod(unitInfo.tenPower).toString(10);
    while (fraction.length < unitInfo.decimals) { fraction = '0' + fraction; }

    // Strip off trailing zeros (but keep one if would otherwise be bare decimal point)
    if (!options.pad) {
        fraction = fraction.match(/^([0-9]*[1-9]|0)(0*)/)[1];
    }

    var whole = value.div(unitInfo.tenPower).toString(10);

    if (options.commify) {
        whole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")
    }

    var value = whole + '.' + fraction;

    if (negative) { value = '-' + value; }

    return value;
}

function parseUnits(value, unitType) {
    var unitInfo = getUnitInfo(unitType || 18);
    if (!unitInfo) { throwError('invalid unitType', { unitType: unitType }); }

    if (typeof(value) !== 'string' || !value.match(/^-?[0-9.,]+$/)) {
        throwError('invalid value', { input: value });
    }

    // Remove commas
    var value = value.replace(/,/g,'');

    // Is it negative?
    var negative = (value.substring(0, 1) === '-');
    if (negative) { value = value.substring(1); }

    if (value === '.') { throwError('invalid value', { input: value }); }

    // Split it into a whole and fractional part
    var comps = value.split('.');
    if (comps.length > 2) { throwError('too many decimal points', { input: value }); }

    var whole = comps[0], fraction = comps[1];
    if (!whole) { whole = '0'; }
    if (!fraction) { fraction = '0'; }

    // Prevent underflow
    if (fraction.length > unitInfo.decimals) {
        throwError('too many decimal places', { input: value, decimals: fraction.length });
    }

    // Fully pad the string with zeros to get to wei
    while (fraction.length < unitInfo.decimals) { fraction += '0'; }

    whole = bigNumberify(whole);
    fraction = bigNumberify(fraction);

    var wei = (whole.mul(unitInfo.tenPower)).add(fraction);

    if (negative) { wei = wei.mul(negative1); }

    return wei;
}

function formatEther(wei, options) {
    return formatUnits(wei, 18, options);
}

function parseEther(ether) {
    return parseUnits(ether, 18);
}

/*
function convert(value, fromUnit, toUnit) {
    var fromUnitInfo = getUnitInfo(fromUnit);
    if (!fromUnitInfo) { throwError('invalid unit name', { unitType: fromUnit }); }
    var toUnitInfo = getUnitInfo(toUnit);
    if (!fromUnitInfo) { throwError('invalid unit name', { unitType: toUnit }); }
    // @TODO: Is 
}
*/

module.exports = {
    formatEther: formatEther,
    parseEther: parseEther,

    formatUnits: formatUnits,
    parseUnits: parseUnits,

//    convert: convert,
}

},{"./bignumber.js":15,"./throw-error":28}],30:[function(require,module,exports){

var convert = require('./convert.js');

// http://stackoverflow.com/questions/18729405/how-to-convert-utf8-string-to-byte-array
function utf8ToBytes(str) {
    var result = [];
    var offset = 0;
    for (var i = 0; i < str.length; i++) {
        var c = str.charCodeAt(i);
        if (c < 128) {
            result[offset++] = c;
        } else if (c < 2048) {
            result[offset++] = (c >> 6) | 192;
            result[offset++] = (c & 63) | 128;
        } else if (((c & 0xFC00) == 0xD800) && (i + 1) < str.length && ((str.charCodeAt(i + 1) & 0xFC00) == 0xDC00)) {
            // Surrogate Pair
            c = 0x10000 + ((c & 0x03FF) << 10) + (str.charCodeAt(++i) & 0x03FF);
            result[offset++] = (c >> 18) | 240;
            result[offset++] = ((c >> 12) & 63) | 128;
            result[offset++] = ((c >> 6) & 63) | 128;
            result[offset++] = (c & 63) | 128;
        } else {
            result[offset++] = (c >> 12) | 224;
            result[offset++] = ((c >> 6) & 63) | 128;
            result[offset++] = (c & 63) | 128;
        }
    }

    return convert.arrayify(result);
};


// http://stackoverflow.com/questions/13356493/decode-utf-8-with-javascript#13691499
function bytesToUtf8(bytes) {
    bytes = convert.arrayify(bytes);

    var result = '';
    var i = 0;

    // Invalid bytes are ignored
    while(i < bytes.length) {
        var c = bytes[i++];
        if (c >> 7 == 0) {
            // 0xxx xxxx
            result += String.fromCharCode(c);
            continue;
        }

        // Invalid starting byte
        if (c >> 6 == 0x02) { continue; }

        // Multibyte; how many bytes left for thus character?
        var extraLength = null;
        if (c >> 5 == 0x06) {
            extraLength = 1;
        } else if (c >> 4 == 0x0e) {
            extraLength = 2;
        } else if (c >> 3 == 0x1e) {
            extraLength = 3;
        } else if (c >> 2 == 0x3e) {
            extraLength = 4;
        } else if (c >> 1 == 0x7e) {
            extraLength = 5;
        } else {
            continue;
        }

        // Do we have enough bytes in our data?
        if (i + extraLength > bytes.length) {

            // If there is an invalid unprocessed byte, try to continue
            for (; i < bytes.length; i++) {
                if (bytes[i] >> 6 != 0x02) { break; }
            }
            if (i != bytes.length) continue;

            // All leftover bytes are valid.
            return result;
        }

        // Remove the UTF-8 prefix from the char (res)
        var res = c & ((1 << (8 - extraLength - 1)) - 1);

        var count;
        for (count = 0; count < extraLength; count++) {
            var nextChar = bytes[i++];

            // Is the char valid multibyte part?
            if (nextChar >> 6 != 0x02) {break;};
            res = (res << 6) | (nextChar & 0x3f);
        }

        if (count != extraLength) {
            i--;
            continue;
        }

        if (res <= 0xffff) {
            result += String.fromCharCode(res);
            continue;
        }

        res -= 0x10000;
        result += String.fromCharCode(((res >> 10) & 0x3ff) + 0xd800, (res & 0x3ff) + 0xdc00);
    }

    return result;
}

module.exports = {
    toUtf8Bytes: utf8ToBytes,
    toUtf8String: bytesToUtf8,
};

},{"./convert.js":18}],31:[function(require,module,exports){
'use strict';

var providers = require('ethers-providers');
var utils = require('ethers-utils');

var Errors = {
    InternalError:    -32603,
    InvalidRequest:   -32600,
    ParseError:       -32700,
    MethodNotFound:   -32601,
    InvalidParams:    -32602,
};

// Some implementations of things do not play well with leading zeros
function smallHexlify(value) {
    value = utils.hexlify(value)
    while (value.length > 3 && value.substring(0, 3) === '0x0') {
        value = '0x' + value.substring(3);
    }
    return value;
}

// Convert a Web3 Transaction into an ethers.js Transaction
function makeTransaction(tx) {
    var result = {};
    ['data', 'from', 'gasPrice', 'to', 'value'].forEach(function(key) {
        if (tx[key] == null) { return; }
        result[key] = tx[key];
    });
    if (tx.gas != null) { result.gasLimit = tx.gas; }
    return result;
}

function fillCompact(values, result, keys, keepNull) {
    keys.forEach(function(key) {
        var value = values[key];
        if (value == null) {
            if (!keepNull) { return; }
            value = null;
        } else {
            value = smallHexlify(value);
        }
        result[key] = value;
    });
}

function fillCopy(values, result, keys, keepNull) {
    keys.forEach(function(key) {
        var value = values[key];
        if (value == null) {
            if (!keepNull) { return; }
            value = null;
        }
        result[key] = value;
    });
}

// Convert ethers.js Block into Web3 Block
function formatBlock(block) {
    var result = {};

    fillCompact(block, result, ['difficulty', 'gasLimit', 'gasUsed', 'number', 'timestamp']);

    fillCopy(block, result, ['extraData', 'miner', 'parentHash']);

    fillCompact(block, result, ['number'], true);

    fillCopy(block, result, ['hash', 'nonce'], true);

    return result;
}

// Convert ethers.js Transaction into Web3 Transaction
function formatTransaction(tx) {
    var result = {};

    if (tx.gasLimit) { result.gas = smallHexlify(tx.gasLimit); }
    result.input = (tx.data || '0x');

    fillCompact(tx, result, ['blockNumber', 'gasPrice', 'nonce', 'transactionIndex', 'value'], true);

    fillCopy(tx, result, ['blockHash', 'from', 'hash', 'to'], true);

    return result;
}


// Convert ethers.js Transaction Receiptinto Web3 Transaction
function formatReceipt(receipt) {
    var result = { logs: [] };

    fillCompact(receipt, result, ['blockNumber', 'cumulativeGasUsed', 'gasPrice', 'gasUsed', 'transactionIndex'], true);

    fillCopy(receipt, result, ['blockHash', 'contractAddress', 'from', 'logsBloom', 'transactionHash', 'root', 'to'], true);

    (receipt.logs || []).forEach(function(log) {
        var log = { };
        result.logs.push(log);

        if (receipt.removed != null) { log.removed = receipt.removed; }
        if (receipt.topics != null) { log.topics = receipt.topics; }

        fillCompact(receipt, log, ['blockNumber', 'logIndex', 'transactionIndex'], true);

        fillCopy(receipt, log, ['address', 'blockHash', 'data', 'transactionHash'], true);
    });

    return result;
}
// Convert ethers.js Log into Web3 Log
function formatLog(log) {
    var result = {};
    ['blockNumber', 'logIndex', 'transactionIndex'].forEach(function(key) {
        if (log[key] == null) { return; }
        result[key] = smallHexlify(log[key]);
    });
    ['address', 'blockHash', 'data', 'topics', 'transactionHash'].forEach(function(key) {
        if (log[key] == null) { return; }
        result[key] = log[key];
    });
    return log;
}


function FilterManager() {
    utils.defineProperty(this, 'filters', {});

    var nextFilterId = 1;
    utils.defineProperty(this, '_getFilterId', function() {
        return nextFilterId++;
    });
}

FilterManager.prototype.addFilter = function(onblock, getLogs) {
    if (!getLogs) { getLogs = function() { return Promise.resolve([]); } }

    var filterId = this._getFilterId();

    var seq = Promise.resolve([]);

    function emitBlock(blockNumber) {
        seq = seq.then(function(result) {
            return new Promise(function(resolve, reject) {
                function check() {
                    provider.getBlock(blockNumber).then(function(block) {
                        onblock(block, result).then(function(result) {
                            resolve(result);
                        });
                    }, function (error) {
                        // Does not exist yet; try again in a second
                        setTimeout(check, 1000);
                    });
                }
                check();
            });
        });
    }

    this.filters[smallHexlify(filterId)] = {
        getChanges: function() {
            var result = seq;

            // Reset the filter results
            seq = Promise.resolve([]);
            return result;
        },
        getLogs: getLogs,
        lastPoll: now(),
        uninstall: function() {
            provider.removeListener('block', emitBlock);
            seq = null;
        }
    };

    provider.on('block', emitBlock);

    return smallHexlify(filterId);
}

FilterManager.prototype.removeFilter = function(filterId) {
    var filter = this.filters[smallHexlify(filterId)];
    if (!filter) { return false; }
    filter.uninstall();
    return true;
}

FilterManager.prototype.getChanges = function(filterId) {
    var filter = this.filters[smallHexlify(filterId)];
    if (!filter) { Promise.resolve([]); }
    return filter.getChanges();
}

FilterManager.prototype.getLogs = function(filterId) {
    var filter = this.filters[smallHexlify(filterId)];
    if (!filter) { return Promise.resolve([]); }
    return filter.getLogs();
}

var version = require('./package.json').version;

function ProviderBridge(provider, signer) {
    if (!(this instanceof ProviderBridge)) { throw new Error('missing new'); }
    this._provider = provider || null;
    this._signer = signer || null;

    var self = this;
    setInterval(function() {
        if (!this._signer) {
            this._address = null;
            return;
        }

        this._signer.getAddress().then(function(address) {
            this._address = address;
        }, function(error) {
            this._address = null;
        });
    }, 1000);

    this._queue = [];

    utils.defineProperty(this, 'isMetaMask', true);
    utils.defineProperty(this, 'isEthers', true);
    utils.defineProperty(this, 'isConnected', true);
    utils.defineProperty(this, 'ethersVersion', version);
    utils.defineProperty(this, 'client', 'ethers/' + version);

    utils.defineProperty(this, 'filterManager', new FilterManager());
}

utils.defineProperty(ProviderBridge.prototype, '_drainQueue', function() {
    var self = this;
    this._queue.forEach(function(operation) {
        setTimeout(function() {
            self._sendAsync(JSON.parse(operation.payload), operation.callback);
        }, 0);
    });
});

utils.defineProperty(ProviderBridge.prototype, 'connectWeb3', function(web3) {
    this._web3 = web3;
    this._drainQueue();
});

utils.defineProperty(ProviderBridge.prototype, 'connectEthers', function(provider, signer) {
    if (!signer) {
        var missingSigner = function() {
            return Promise.reject('no signer connected');
        };

        signer = {
            getAddress: missingSigner,
            sendTransaction: missingSigner,
            signMessage: missingSigner,
        };
    }

    this._provider = provider;
    this._signer = signer;

    this._drainQueue();
});

utils.defineProperty(ProviderBridge.prototype, 'sendAsync', function(payload, callback) {
    if (!(this._provider || this._web3)) {
        this._queue.push({
            payload: JSON.stringify(payload),
            callback: callback
        });
        return;
    }
    this._sendAsync(payload, callback);
});

utils.defineProperty(ProviderBridge.prototype, '_sendAsync', function(payload, callback) {
    if (this._web3) {
        this._web3.sendAsync(payload, callback);
        return;
    }

    var self = this;

    if (Array.isArray(payload)) {

        var promises = [];
        payload.forEach(function(payload) {
            promises.push(new Promise(function(resolve, reject) {
                self.sendAsync(payload, function(error, result) {
                    resolve(error || result);
                });
            }));
        });

        Promise.all(promises).then(function(result) {
            callback(null, result);
        });

        return;
    }


    function respondError(message, code) {
        if (!code) { code = Errors.InternalError; }

        callback(null, {
            id: payload.id,
            jsonrpc: "2.0",
            error: {
                code: code,
                message: message
            }
        });
    }

    function respond(result) {
        callback(null, {
            id: payload.id,
            jsonrpc: "2.0",
            result: result
        });
    }

    if (payload == null || typeof(payload.method) !== 'string' || typeof(payload.id) !== 'number' || !Array.isArray(payload.params)) {
        respondError('invalid sendAsync parameters', Errors.InvalidRequest);
        return;
    }

    var signer = this._signer;
    var provider = this._provider;

    var params = payload.params;
    switch (payload.method) {

        // Account Actions

        case 'eth_accounts':
            signer.getAddress().then(function(address) {
                respond([ address.toLowerCase() ]);
            }, function (error) {
                respond([]);
            });
            break;

        case 'eth_sign':
            params = [ params[1], params[0] ];
            // Fall-through

        case 'personal_sign':
            signer.getAddress().then(function(address) {
                if (utils.getAddress(params[1]) !== address) {
                    respondError('invalid from address', Errors.InvalidParams);
                    return;
                }

                signer.signMessage(params[0]).then(function(signature) {
                    respond(signature);
                }, function(error) {
                    respondError('eth_sign error', Errors.InternalError);
                });
            }, function(error) {
                respondError('no account', Errors.InvalidParams);
            });

            break;

        case 'eth_sendTransaction':
            signer.getAddress().then(function(address) {
                if (utils.getAddress(params[0].from) !== address) {
                    respondError('invalid from address', Errors.InvalidParams);
                }
                return signer.sendTransaction(params[0])
            }, function(error) {
                respondError('eth_sendTransaction error', Errors.InternalError);
            });
            break;


        // Client State (mostly just default values we can pull from sync)

        case 'eth_coinbase':
        case 'eth_getCompilers':
        case 'eth_hashrate':
        case 'eth_mining':
        case 'eth_syncing':
        case 'net_listening':
        case 'net_peerCount':
        case 'net_version':
        case 'eth_protocolVersion':
            setTimeout(function() {
                respond(self.send(payload).result);
            }, 0);
            break;

        // Blockchain state

        case 'eth_blockNumber':
            provider.getBlockNumber().then(function(blockNumber) {
                respond(smallHexlify(blockNumber));
            });
            break;

        case 'eth_gasPrice':
            provider.getGasPrice().then(function(gasPrice) {
                respond(smallHexlify(gasPrice));
            });
            break;


        // Accounts Actions

        case 'eth_getBalance':
            provider.getBalance(params[0], params[1]).then(function(balance) {
                respond(smallHexlify(balance));
            });
            break;

        case 'eth_getCode':
            provider.getCode(params[0], params[1]).then(function(code) {
                respond(code);
            });
            break;

        case 'eth_getTransactionCount':
            provider.getTransactionCount(params[0], params[1]).then(function(nonce) {
                respond(smallHexlify(nonce));
            });
            break;


        // Execution (read-only)

        case 'eth_call':
            provider.call(makeTransaction(params[0]), params[1]).then(function(data) {
                respond(data);
            });
            break;

        case 'eth_estimateGas':
            provider.estimateGas(makeTransaction(params[0]), params[1]).then(function(data) {
                respond(data);
            });
            break;

        case 'eth_getStorageAt':
            provider.getStorageAt(params[0], params[1], params[2]).then(function(data) {
                respond(data);
            });
            break;


        // Blockchain Queries

        case 'eth_getBlockByHash':
        case 'eth_getBlockByNumber':
            provider.getBlock(params[0]).then(function(block) {
                var result = formatBlock(block);

                if (params[1]) {
                    result.transactions = [];

                    var seq = Promise.resolve();

                    if (block.transactions) {
                        block.transactions.forEach(function(hash) {
                            return provider.getTransaction(hash).then(function(tx) {
                                result.transactions.push(tx);
                            });
                        });
                    }

                    seq.then(function() {
                        respond(result);
                    });

                } else {
                    if (block.transactions) { result.transactions = block.transactions; }
                    respond(result);
                }
            });
            break;

        case 'eth_getBlockTransactionCountByHash':
        case 'eth_getBlockTransactionCountByNumber':
            provider.getBlock(params[0]).then(function(block) {
                respond(smallHexlify(block.transactions ? block.transactions.length: 0));
            });
            break;

        case 'eth_getTransactionByHash':
            provider.getTransaction(params[0]).then(function(tx) {
                if (tx != null) { tx = formatTransaction(tx); }
                respond(tx);
            });
            break;

        case 'eth_getTransactionByBlockHashAndIndex':
        case 'eth_getTransactionByBlockNumberAndIndex':
            provider.getBlock(params[0]).then(function(block) {
                if (block == null) { block = {}; }
                if (block.transactions == null) { block.transactions = []; }
                var hash = block.transactions[params[1]];
                if (hash) {
                    provider.getTransaction(hash).then(function(tx) {
                        if (tx != null) { tx = formatTransaction(tx); }
                        respond(tx);
                    });
                } else {
                    respond(null);
                }
            });
            break;

        case 'eth_getTransactionReceipt':
            provider.getTransactionReceipt(params[0]).then(function(receipt) {
                if (receipt != null) { receipt = formatReceipt(receipt); }
                respond(receipt);
            });
            break;


        // Blockchain Manipulation

        case 'eth_sendRawTransaction':
            provider.sendTransaction(params[0]).then(function(hash) {
                respond(hash);
            });
            break;


        // Unsupported methods
        case 'eth_getUncleByBlockHashAndIndex':
        case 'eth_getUncleByBlockNumberAndIndex':

        case 'eth_getUncleCountByBlockHash':
        case 'eth_getUncleCountByBlockNumber':
            respondError('unsupported method', { method: payload.method });
            break;

        // Filters

        case 'eth_newFilter':
            (function(filter) {
                function getLogs(filter) {
                    return provider.getLogs(filter).then(function(result) {
                        for (var i = 0; i < result.length; i++) {
                            result[i] = formatLog(result[i]);
                        }
                        return result;
                    });
                }

                respond(self.filterManager.addFilter(function(block, result) {
                    var blockFilter = {
                        fromBlock: block.number,
                        toBlock: block.number
                    }
                    if (filter.address) { blockFilter.address = filter.address; }
                    if (filter.topics) { blockFilter.topics = filter.topics; }
                    return provider.getLogs(blockFilter).then(function(logs) {
                        logs.forEach(function(log) {
                            log.blockHash = block.hash;
                            result.push(formatLog(log));
                        });
                        return result;
                    });

                }, function() {
                    return provider.getLogs(filter).then(function(logs) {
                        var seq = Promise.resolve(logs);
                        logs.forEach(function(log) {
                            seq = seq.then(function() {
                                return provider.getBlock(log.blockNumber).then(function(block) {
                                    log.blockHash = block.hash;
                                    return logs;
                                });
                            });
                        });
                        return seq;
                    });
                }));
            })(params[0]);
            break;

        case 'eth_newPendingTransactionFilter':
            respond(this.filterManager.addFilter(function(block, result) {
                (block.transactions || []).forEach(function(hash) {
                     result.push(hash);
                });
                result.push(block.hash);
                return Promise.resolve(result);
            }));
            break;

        case 'eth_newBlockFilter':
            respond(this.filterManager.addFilter(function(block, result) {
                result.push(block.hash);
                return Promise.resolve(result);
            }));
            break;

        case 'eth_uninstallFilter':
            respond(this.filterManager.removeFilter(params[0]));
            break;

        case 'eth_getFilterChanges':
            this.filterManager.getChanges(params[0]).then(function(result) {
                respond(result);
            });
            break;

        case 'eth_getFilterLogs':
            this.filterManager.getLogs(params[0]).then(function(result) {
                respond(result);
            });
            break;

        default:
            respondError('unknown method', Errors.MethodNotFound);
    }
});

utils.defineProperty(ProviderBridge.prototype, 'send', function(payload) {
    if (this._web3) {
        return this._web3.send(payload);
    }

    var provider = this._provider;

    var result = null;
    switch(payload.method) {
        case 'eth_accounts':
            if (this._address) {
                result = [ this._address.toLowerCase() ];
            } else {
                result = [ ];
            }
            break;

        case 'eth_coinbase':
            result = null;
            break;

        case 'eth_getCompilers':
            result = [];
            break;

        case 'eth_hashrate':
        case 'net_peerCount':
            result = "0x0";
            break;

        case 'eth_mining':
        case 'eth_syncing':
        case 'net_listening':
            result = false;
            break;

        case 'net_version':
            result = String(provider.chainId);
            break;

        // Using Parity/v1.8.0-beta-9882902-20171015/x86_64-macos/rustc1.20.0:
        // /Users/ethers>  curl -H 'Content-Type: application/json' -X POST --data '{"jsonrpc":"2.0","method":"eth_protocolVersion","params":[],"id":67}' http://localhost:8545
        // {"jsonrpc":"2.0","result":"63","id":67}
        case 'eth_protocolVersion':
            result = "63";
            break;

        default:
            throw new Error('sync unsupported');
    }

    return {
        id: payload.id,
        jsonrpc: "2.0",
        result: result
    };
});

module.exports = ProviderBridge;

},{"./package.json":32,"ethers-providers":7,"ethers-utils":20}],32:[function(require,module,exports){
module.exports={
  "_from": "ethers-web3-bridge@0.0.1",
  "_id": "ethers-web3-bridge@0.0.1",
  "_inBundle": false,
  "_integrity": "sha512-dnLJxFtO1BmgkmPM2v7JqiUuvcYapiKLXJKq2QcAREyKDnIUAsFeh/Hb80cn9ABJNFK9EYToqee/Ry0c1s7w/Q==",
  "_location": "/ethers-web3-bridge",
  "_phantomChildren": {},
  "_requested": {
    "type": "version",
    "registry": true,
    "raw": "ethers-web3-bridge@0.0.1",
    "name": "ethers-web3-bridge",
    "escapedName": "ethers-web3-bridge",
    "rawSpec": "0.0.1",
    "saveSpec": null,
    "fetchSpec": "0.0.1"
  },
  "_requiredBy": [
    "/"
  ],
  "_resolved": "https://registry.npmjs.org/ethers-web3-bridge/-/ethers-web3-bridge-0.0.1.tgz",
  "_shasum": "bdd5792ecad08609abecd8055acc085cdf388588",
  "_spec": "ethers-web3-bridge@0.0.1",
  "_where": "/Users/yuetloo/projects/ethers.io/ethers-app",
  "author": {
    "name": "Richard Moore",
    "email": "me@ricmoo.com"
  },
  "bundleDependencies": false,
  "dependencies": {
    "ethers-providers": "^2.1.19",
    "ethers-utils": "^2.1.11"
  },
  "deprecated": false,
  "description": "Enables Web3 instances to connect using an ethers.js Provider.",
  "keywords": [
    "ethereum",
    "web3",
    "ethers",
    "dapp"
  ],
  "license": "MIT",
  "main": "index.js",
  "name": "ethers-web3-bridge",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "version": "0.0.1"
}

},{}],33:[function(require,module,exports){
(function (global){
!function(e){if("object"==typeof exports&&"undefined"!=typeof module)module.exports=e();else if("function"==typeof define&&define.amd)define([],e);else{("undefined"!=typeof window?window:"undefined"!=typeof global?global:"undefined"!=typeof self?self:this).ethers=e()}}(function(){return function o(s,a,u){function l(t,e){if(!a[t]){if(!s[t]){var r="function"==typeof require&&require;if(!e&&r)return r(t,!0);if(f)return f(t,!0);var n=new Error("Cannot find module '"+t+"'");throw n.code="MODULE_NOT_FOUND",n}var i=a[t]={exports:{}};s[t][0].call(i.exports,function(e){return l(s[t][1][e]||e)},i,i.exports,o,s,a,u)}return a[t].exports}for(var f="function"==typeof require&&require,e=0;e<u.length;e++)l(u[e]);return l}({1:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),r.version="4.0.13"},{}],2:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./utils/properties"),i=function(){function e(){n.setType(this,"Signer")}return e.isSigner=function(e){return n.isType(e,"Signer")},e}();r.Signer=i},{"./utils/properties":72}],3:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./utils/bignumber");r.AddressZero="0x0000000000000000000000000000000000000000";r.HashZero="0x0000000000000000000000000000000000000000000000000000000000000000";r.EtherSymbol="\u039e";var i=n.bigNumberify(-1);r.NegativeOne=i;var o=n.bigNumberify(0);r.Zero=o;var s=n.bigNumberify(1);r.One=s;var a=n.bigNumberify(2);r.Two=a;var u=n.bigNumberify("1000000000000000000");r.WeiPerEther=u;var l=n.bigNumberify("0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff");r.MaxUint256=l},{"./utils/bignumber":61}],4:[function(e,t,r){"use strict";var n,i=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var l=e("./constants"),f=o(e("./errors")),h=e("./utils/abi-coder"),s=e("./utils/address"),c=e("./utils/bignumber"),d=e("./utils/bytes"),a=e("./utils/interface"),p=e("./utils/properties"),u=e("./providers/abstract-provider"),v=e("./abstract-signer"),m=function(n){function t(e,t){var r=n.call(this)||this;return p.defineReadOnly(r,"address",e),p.defineReadOnly(r,"provider",t),r}return i(t,n),t.prototype.getAddress=function(){return Promise.resolve(this.address)},t.prototype._fail=function(e,t){return Promise.resolve().then(function(){f.throwError(e,f.UNSUPPORTED_OPERATION,{operation:t})})},t.prototype.signMessage=function(e){return this._fail("VoidSigner cannot sign messages","signMessage")},t.prototype.sendTransaction=function(e){return this._fail("VoidSigner cannot sign transactions","sendTransaction")},t.prototype.connect=function(e){return new t(this.address,e)},t}(v.Signer);r.VoidSigner=m;var y={chainId:!0,data:!0,from:!0,gasLimit:!0,gasPrice:!0,nonce:!0,to:!0,value:!0};function g(s,e,a){var u=s.interface.functions[e];return function(){for(var i=this,e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];var o={},r=null;if(e.length===u.inputs.length+1&&"object"==typeof e[e.length-1])for(var n in null!=(o=p.shallowCopy(e.pop())).blockTag&&(r=o.blockTag),delete o.blockTag,o)if(!y[n])throw new Error("unknown transaction override "+n);if(e.length!=u.inputs.length)throw new Error("incorrect number of arguments");return["data","to"].forEach(function(e){null!=o[e]&&f.throwError("cannot override "+e,f.UNSUPPORTED_OPERATION,{operation:e})}),o.to=s.deployed().then(function(){return s.addressPromise}),function n(i,o,e){if(Array.isArray(e)){var s=[];return e.forEach(function(e,t){var r=null;r=Array.isArray(o)?o[t]:o[e.name],s.push(n(i,r,e))}),Promise.all(s)}if("address"===e.type)return i.resolveName(o);if("tuple"===e.type)return n(i,o,e.components);var t=e.type.match(/(.*)(\[[0-9]*\]$)/);if(t){if(!Array.isArray(o))throw new Error("invalid value for array");var r=[],a={components:e.components,type:t[1]};return o.forEach(function(e){r.push(n(i,e,a))}),Promise.all(r)}return Promise.resolve(o)}(s.provider,e,u.inputs).then(function(n){if(o.data=u.encode(n),"call"===u.type)return a?Promise.resolve(l.Zero):(s.provider||f.throwError("call (constant functions) require a provider or a signer with a provider",f.UNSUPPORTED_OPERATION,{operation:"call"}),["gasLimit","gasPrice","value"].forEach(function(e){if(null!=o[e])throw new Error("call cannot override "+e)}),null==o.from&&s.signer&&(o.from=s.signer.getAddress()),s.provider.call(o,r).then(function(t){if(d.hexDataLength(t)%32==4&&"0x08c379a0"===d.hexDataSlice(t,0,4)){var e=h.defaultAbiCoder.decode(["string"],d.hexDataSlice(t,4));f.throwError("call revert exception",f.CALL_EXCEPTION,{address:s.address,args:n,method:u.signature,errorSignature:"Error(string)",errorArgs:[e],reason:e,transaction:o})}try{var r=u.decode(t);return 1===u.outputs.length&&(r=r[0]),r}catch(e){throw"0x"===t&&0<u.outputs.length&&f.throwError("call exception",f.CALL_EXCEPTION,{address:s.address,method:u.signature,args:n}),e}}));if("transaction"===u.type)return a?(s.provider||f.throwError("estimate gas require a provider or a signer with a provider",f.UNSUPPORTED_OPERATION,{operation:"estimateGas"}),null==o.from&&s.signer&&(o.from=s.signer.getAddress()),s.provider.estimateGas(o)):(null==o.gasLimit&&null!=u.gas&&(o.gasLimit=c.bigNumberify(u.gas).add(21e3)),s.signer||f.throwError("sending a transaction require a signer",f.UNSUPPORTED_OPERATION,{operation:"sendTransaction"}),null!=o.from&&f.throwError("cannot override from in a transaction",f.UNSUPPORTED_OPERATION,{operation:"sendTransaction"}),s.signer.sendTransaction(o).then(function(e){var t=e.wait.bind(e);return e.wait=function(e){return t(e).then(function(n){return n.events=n.logs.map(function(e){var t=p.deepCopy(e),r=i.interface.parseLog(e);return r&&(t.args=r.values,t.decode=r.decode,t.event=r.name,t.eventSignature=r.signature),t.removeListener=function(){return i.provider},t.getBlock=function(){return i.provider.getBlock(n.blockHash)},t.getTransaction=function(){return i.provider.getTransaction(n.transactionHash)},t.getTransactionReceipt=function(){return Promise.resolve(n)},t}),n})},e}));throw new Error("invalid type - "+u.type)})}}function b(e){return!e.address||null!=e.topics&&0!==e.topics.length?(e.address||"*")+"@"+(e.topics?e.topics.join(":"):""):"*"}var w=function(){function i(t,e,r){var n=this;if(f.checkNew(this,i),a.Interface.isInterface(e)?p.defineReadOnly(this,"interface",e):p.defineReadOnly(this,"interface",new a.Interface(e)),v.Signer.isSigner(r)?(p.defineReadOnly(this,"provider",r.provider),p.defineReadOnly(this,"signer",r)):u.Provider.isProvider(r)?(p.defineReadOnly(this,"provider",r),p.defineReadOnly(this,"signer",null)):f.throwError("invalid signer or provider",f.INVALID_ARGUMENT,{arg:"signerOrProvider",value:r}),p.defineReadOnly(this,"estimate",{}),p.defineReadOnly(this,"functions",{}),p.defineReadOnly(this,"filters",{}),Object.keys(this.interface.events).forEach(function(e){var r=n.interface.events[e];p.defineReadOnly(n.filters,e,function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];return{address:n.address,topics:r.encodeTopics(e)}})}),this._events=[],p.defineReadOnly(this,"address",t),this.provider)p.defineReadOnly(this,"addressPromise",this.provider.resolveName(t).then(function(e){if(null==e)throw new Error("name not found");return e}).catch(function(e){throw console.log("ERROR: Cannot find Contract - "+t),e}));else try{p.defineReadOnly(this,"addressPromise",Promise.resolve(s.getAddress(t)))}catch(e){f.throwError("provider is required to use non-address contract address",f.INVALID_ARGUMENT,{argument:"addressOrName",value:t})}Object.keys(this.interface.functions).forEach(function(e){var t=g(n,e,!1);null==n[e]?p.defineReadOnly(n,e,t):console.log("WARNING: Multiple definitions for "+e),null==n.functions[e]&&(p.defineReadOnly(n.functions,e,t),p.defineReadOnly(n.estimate,e,g(n,e,!0)))})}return i.prototype.deployed=function(){var t=this;return this._deployed||(this.deployTransaction?this._deployed=this.deployTransaction.wait().then(function(){return t}):this._deployed=this.provider.getCode(this.address).then(function(e){return"0x"===e&&f.throwError("contract not deployed",f.UNSUPPORTED_OPERATION,{contractAddress:t.address,operation:"getDeployed"}),t})),this._deployed},i.prototype.fallback=function(e){var t=this;this.signer||f.throwError("sending a transaction require a signer",f.UNSUPPORTED_OPERATION,{operation:"sendTransaction(fallback)"});var r=p.shallowCopy(e||{});return["from","to"].forEach(function(e){null!=r[e]&&f.throwError("cannot override "+e,f.UNSUPPORTED_OPERATION,{operation:e})}),r.to=this.addressPromise,this.deployed().then(function(){return t.signer.sendTransaction(r)})},i.prototype.connect=function(e){"string"==typeof e&&(e=new m(e,this.provider));var t=new i(this.address,this.interface,e);return this.deployTransaction&&p.defineReadOnly(t,"deployTransaction",this.deployTransaction),t},i.prototype.attach=function(e){return new i(e,this.interface,this.signer||this.provider)},i.isIndexed=function(e){return a.Interface.isIndexed(e)},i.prototype._getEventFilter=function(e){var r=this;if("string"==typeof e){if("*"===e)return{prepareEvent:function(e){var t=r.interface.parseLog(e);return t&&(e.args=t.values,e.decode=t.decode,e.event=t.name,e.eventSignature=t.signature),[e]},eventTag:"*",filter:{address:this.address}};-1!==e.indexOf("(")&&(e=h.formatSignature(h.parseSignature("event "+e)));var n=this.interface.events[e];n||f.throwError("unknown event - "+e,f.INVALID_ARGUMENT,{argumnet:"eventName",value:e});var t={address:this.address,topics:[n.topic]};return{prepareEvent:function(e){var t=n.decode(e.data,e.topics);e.args=t;var r=Array.prototype.slice.call(t);return r.push(e),r},event:n,eventTag:b(t),filter:t}}var i={address:this.address},o=null;if(e.topics&&e.topics[0])for(var s in i.topics=e.topics,this.interface.events)if(-1!==s.indexOf("(")){var a=this.interface.events[s];if(a.topic===e.topics[0].toLowerCase()){o=a;break}}return{prepareEvent:function(e){if(!o)return[e];var t=o.decode(e.data,e.topics);e.args=t;var r=Array.prototype.slice.call(t);return r.push(e),r},event:o,eventTag:b(i),filter:i}},i.prototype._addEventListener=function(n,i,e){var o=this;this.provider||f.throwError("events require a provider or a signer with a provider",f.UNSUPPORTED_OPERATION,{operation:"once"});var t=function(e){var t=p.deepCopy(e),r=n.prepareEvent(t);n.event&&(t.decode=n.event.decode,t.event=n.event.name,t.eventSignature=n.event.signature),t.removeListener=function(){o.removeListener(n.filter,i)},t.getBlock=function(){return o.provider.getBlock(e.blockHash)},t.getTransaction=function(){return o.provider.getTransaction(e.transactionHash)},t.getTransactionReceipt=function(){return o.provider.getTransactionReceipt(e.transactionHash)},o.emit.apply(o,[n.filter].concat(r))};this.provider.on(n.filter,t),this._events.push({eventFilter:n,listener:i,wrappedListener:t,once:e})},i.prototype.on=function(e,t){return this._addEventListener(this._getEventFilter(e),t,!1),this},i.prototype.once=function(e,t){return this._addEventListener(this._getEventFilter(e),t,!0),this},i.prototype.addListener=function(e,t){return this.on(e,t)},i.prototype.emit=function(e){for(var t=this,r=[],n=1;n<arguments.length;n++)r[n-1]=arguments[n];if(!this.provider)return!1;var i=!1,o=this._getEventFilter(e);return this._events=this._events.filter(function(e){return e.eventFilter.eventTag!==o.eventTag||(setTimeout(function(){e.listener.apply(t,r)},0),i=!0,!e.once)}),i},i.prototype.listenerCount=function(e){if(!this.provider)return 0;var t=this._getEventFilter(e);return this._events.filter(function(e){return e.eventFilter.eventTag===t.eventTag}).length},i.prototype.listeners=function(e){if(!this.provider)return[];var t=this._getEventFilter(e);return this._events.filter(function(e){return e.eventFilter.eventTag===t.eventTag}).map(function(e){return e.listener})},i.prototype.removeAllListeners=function(e){if(!this.provider)return this;var t=this._getEventFilter(e);return this._events=this._events.filter(function(e){return e.eventFilter.eventTag!==t.eventTag}),this},i.prototype.removeListener=function(e,t){var r=this;if(!this.provider)return this;var n=!1,i=this._getEventFilter(e);return this._events=this._events.filter(function(e){return e.eventFilter.eventTag!==i.eventTag||(e.listener!==t||(r.provider.removeListener(e.eventFilter.filter,e.wrappedListener),!!n||!(n=!0)))}),this},i}();r.Contract=w;var _=function(){function i(e,t,r){var n=null;"string"==typeof t?n=t:d.isArrayish(t)?n=d.hexlify(t):"string"==typeof t.object?n=t.object:f.throwError("bytecode must be a valid hex string",f.INVALID_ARGUMENT,{arg:"bytecode",value:t}),"0x"!==n.substring(0,2)&&(n="0x"+n),d.isHexString(n)||f.throwError("bytecode must be a valid hex string",f.INVALID_ARGUMENT,{arg:"bytecode",value:t}),n.length%2!=0&&f.throwError("bytecode must be valid data (even length)",f.INVALID_ARGUMENT,{arg:"bytecode",value:t}),p.defineReadOnly(this,"bytecode",n),a.Interface.isInterface(e)?p.defineReadOnly(this,"interface",e):p.defineReadOnly(this,"interface",new a.Interface(e)),r&&!v.Signer.isSigner(r)&&f.throwError("invalid signer",f.INVALID_ARGUMENT,{arg:"signer",value:null}),p.defineReadOnly(this,"signer",r||null)}return i.prototype.getDeployTransaction=function(){for(var e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];var r={};if(e.length===this.interface.deployFunction.inputs.length+1)for(var n in r=p.shallowCopy(e.pop()))if(!y[n])throw new Error("unknown transaction override "+n);return["data","from","to"].forEach(function(e){null!=r[e]&&f.throwError("cannot override "+e,f.UNSUPPORTED_OPERATION,{operation:e})}),f.checkArgumentCount(e.length,this.interface.deployFunction.inputs.length," in Contract constructor"),r.data=this.interface.deployFunction.encode(this.bytecode,e),r},i.prototype.deploy=function(){for(var r=this,e=[],t=0;t<arguments.length;t++)e[t]=arguments[t];var n=this.getDeployTransaction.apply(this,e);return this.signer.sendTransaction(n).then(function(e){var t=new w(s.getContractAddress(e),r.interface,r.signer);return p.defineReadOnly(t,"deployTransaction",e),t})},i.prototype.attach=function(e){return new w(e,this.interface,this.signer)},i.prototype.connect=function(e){return new i(this.interface,this.bytecode,e)},i.fromSolidity=function(e,t){null==e&&f.throwError("missing compiler output",f.MISSING_ARGUMENT,{argument:"compilerOutput"}),"string"==typeof e&&(e=JSON.parse(e));var r=e.abi,n=null;return e.bytecode?n=e.bytecode:e.evm&&e.evm.bytecode&&(n=e.evm.bytecode),new i(r,n,t)},i}();r.ContractFactory=_},{"./abstract-signer":2,"./constants":3,"./errors":5,"./providers/abstract-provider":49,"./utils/abi-coder":58,"./utils/address":59,"./utils/bignumber":61,"./utils/bytes":62,"./utils/interface":67,"./utils/properties":72}],5:[function(e,t,s){"use strict";Object.defineProperty(s,"__esModule",{value:!0});var a=e("./_version");s.UNKNOWN_ERROR="UNKNOWN_ERROR",s.NOT_IMPLEMENTED="NOT_IMPLEMENTED",s.MISSING_NEW="MISSING_NEW",s.CALL_EXCEPTION="CALL_EXCEPTION",s.INVALID_ARGUMENT="INVALID_ARGUMENT",s.MISSING_ARGUMENT="MISSING_ARGUMENT",s.UNEXPECTED_ARGUMENT="UNEXPECTED_ARGUMENT",s.NUMERIC_FAULT="NUMERIC_FAULT",s.INSUFFICIENT_FUNDS="INSUFFICIENT_FUNDS",s.NONCE_EXPIRED="NONCE_EXPIRED",s.REPLACEMENT_UNDERPRICED="REPLACEMENT_UNDERPRICED";var r=!(s.UNSUPPORTED_OPERATION="UNSUPPORTED_OPERATION"),u=!1;function n(e,t,r){if(u)throw new Error("unknown error");t||(t=s.UNKNOWN_ERROR),r||(r={});var n=[];Object.keys(r).forEach(function(t){try{n.push(t+"="+JSON.stringify(r[t]))}catch(e){n.push(t+"="+JSON.stringify(r[t].toString()))}}),n.push("version="+a.version);var i=e;n.length&&(e+=" ("+n.join(", ")+")");var o=new Error(e);throw o.reason=i,o.code=t,Object.keys(r).forEach(function(e){o[e]=r[e]}),o}s.throwError=n,s.checkNew=function(e,t){e instanceof t||n("missing new",s.MISSING_NEW,{name:t.name})},s.checkArgumentCount=function(e,t,r){r||(r=""),e<t&&n("missing argument"+r,s.MISSING_ARGUMENT,{count:e,expectedCount:t}),t<e&&n("too many arguments"+r,s.UNEXPECTED_ARGUMENT,{count:e,expectedCount:t})},s.setCensorship=function(e,t){r&&n("error censorship permanent",s.UNSUPPORTED_OPERATION,{operation:"setCersorship"}),u=!!e,r=!!t},s.checkNormalize=function(){try{if(String.fromCharCode(233).normalize("NFD")!==String.fromCharCode(101,769))throw new Error("broken")}catch(e){n("platform missing String.prototype.normalize",s.UNSUPPORTED_OPERATION,{operation:"String.prototype.normalize"})}}},{"./_version":1}],6:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=e("./contract");r.Contract=i.Contract,r.ContractFactory=i.ContractFactory,r.VoidSigner=i.VoidSigner;var o=e("./abstract-signer");r.Signer=o.Signer;var s=e("./wallet");r.Wallet=s.Wallet;var a=n(e("./constants"));r.constants=a;var u=n(e("./errors"));r.errors=u;var l=n(e("./providers"));r.providers=l;var f=n(e("./utils"));r.utils=f;var h=n(e("./wordlists"));r.wordlists=h;var c=e("./utils/shims");r.platform=c.platform;var d=e("./_version");r.version=d.version,r.getDefaultProvider=function(e){null==e&&(e="homestead");var t=f.getNetwork(e);return t&&t._defaultProvider||u.throwError("unsupported getDefaultProvider network",u.UNSUPPORTED_OPERATION,{operation:"getDefaultProvider",network:e}),t._defaultProvider(l)}},{"./_version":1,"./abstract-signer":2,"./constants":3,"./contract":4,"./errors":5,"./providers":53,"./utils":66,"./utils/shims":78,"./wallet":86,"./wordlists":87}],7:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=n(e("./ethers"));r.ethers=i,function(e){for(var t in e)r.hasOwnProperty(t)||(r[t]=e[t])}(e("./ethers"))},{"./ethers":6}],8:[function(e,C,B){"use strict";!function(e){function r(e){return parseInt(e)===e}function n(e){if(!r(e.length))return!1;for(var t=0;t<e.length;t++)if(!r(e[t])||e[t]<0||255<e[t])return!1;return!0}function o(e,t){if(e.buffer&&ArrayBuffer.isView(e)&&"Uint8Array"===e.name)return t&&(e=e.slice?e.slice():Array.prototype.slice.call(e)),e;if(Array.isArray(e)){if(!n(e))throw new Error("Array contains invalid value: "+e);return new Uint8Array(e)}if(r(e.length)&&n(e))return new Uint8Array(e);throw new Error("unsupported array-like object")}function u(e){return new Uint8Array(e)}function s(e,t,r,n,i){null==n&&null==i||(e=e.slice?e.slice(n,i):Array.prototype.slice.call(e,n,i)),t.set(e,r)}var i,t={toBytes:function(e){var t=[],r=0;for(e=encodeURI(e);r<e.length;){var n=e.charCodeAt(r++);37===n?(t.push(parseInt(e.substr(r,2),16)),r+=2):t.push(n)}return o(t)},fromBytes:function(e){for(var t=[],r=0;r<e.length;){var n=e[r];n<128?(t.push(String.fromCharCode(n)),r++):191<n&&n<224?(t.push(String.fromCharCode((31&n)<<6|63&e[r+1])),r+=2):(t.push(String.fromCharCode((15&n)<<12|(63&e[r+1])<<6|63&e[r+2])),r+=3)}return t.join("")}},a=(i="0123456789abcdef",{toBytes:function(e){for(var t=[],r=0;r<e.length;r+=2)t.push(parseInt(e.substr(r,2),16));return t},fromBytes:function(e){for(var t=[],r=0;r<e.length;r++){var n=e[r];t.push(i[(240&n)>>4]+i[15&n])}return t.join("")}}),h={16:10,24:12,32:14},c=[1,2,4,8,16,32,64,128,27,54,108,216,171,77,154,47,94,188,99,198,151,53,106,212,179,125,250,239,197,145],d=[99,124,119,123,242,107,111,197,48,1,103,43,254,215,171,118,202,130,201,125,250,89,71,240,173,212,162,175,156,164,114,192,183,253,147,38,54,63,247,204,52,165,229,241,113,216,49,21,4,199,35,195,24,150,5,154,7,18,128,226,235,39,178,117,9,131,44,26,27,110,90,160,82,59,214,179,41,227,47,132,83,209,0,237,32,252,177,91,106,203,190,57,74,76,88,207,208,239,170,251,67,77,51,133,69,249,2,127,80,60,159,168,81,163,64,143,146,157,56,245,188,182,218,33,16,255,243,210,205,12,19,236,95,151,68,23,196,167,126,61,100,93,25,115,96,129,79,220,34,42,144,136,70,238,184,20,222,94,11,219,224,50,58,10,73,6,36,92,194,211,172,98,145,149,228,121,231,200,55,109,141,213,78,169,108,86,244,234,101,122,174,8,186,120,37,46,28,166,180,198,232,221,116,31,75,189,139,138,112,62,181,102,72,3,246,14,97,53,87,185,134,193,29,158,225,248,152,17,105,217,142,148,155,30,135,233,206,85,40,223,140,161,137,13,191,230,66,104,65,153,45,15,176,84,187,22],l=[82,9,106,213,48,54,165,56,191,64,163,158,129,243,215,251,124,227,57,130,155,47,255,135,52,142,67,68,196,222,233,203,84,123,148,50,166,194,35,61,238,76,149,11,66,250,195,78,8,46,161,102,40,217,36,178,118,91,162,73,109,139,209,37,114,248,246,100,134,104,152,22,212,164,92,204,93,101,182,146,108,112,72,80,253,237,185,218,94,21,70,87,167,141,157,132,144,216,171,0,140,188,211,10,247,228,88,5,184,179,69,6,208,44,30,143,202,63,15,2,193,175,189,3,1,19,138,107,58,145,17,65,79,103,220,234,151,242,207,206,240,180,230,115,150,172,116,34,231,173,53,133,226,249,55,232,28,117,223,110,71,241,26,113,29,41,197,137,111,183,98,14,170,24,190,27,252,86,62,75,198,210,121,32,154,219,192,254,120,205,90,244,31,221,168,51,136,7,199,49,177,18,16,89,39,128,236,95,96,81,127,169,25,181,74,13,45,229,122,159,147,201,156,239,160,224,59,77,174,42,245,176,200,235,187,60,131,83,153,97,23,43,4,126,186,119,214,38,225,105,20,99,85,33,12,125],f=[3328402341,4168907908,4000806809,4135287693,4294111757,3597364157,3731845041,2445657428,1613770832,33620227,3462883241,1445669757,3892248089,3050821474,1303096294,3967186586,2412431941,528646813,2311702848,4202528135,4026202645,2992200171,2387036105,4226871307,1101901292,3017069671,1604494077,1169141738,597466303,1403299063,3832705686,2613100635,1974974402,3791519004,1033081774,1277568618,1815492186,2118074177,4126668546,2211236943,1748251740,1369810420,3521504564,4193382664,3799085459,2883115123,1647391059,706024767,134480908,2512897874,1176707941,2646852446,806885416,932615841,168101135,798661301,235341577,605164086,461406363,3756188221,3454790438,1311188841,2142417613,3933566367,302582043,495158174,1479289972,874125870,907746093,3698224818,3025820398,1537253627,2756858614,1983593293,3084310113,2108928974,1378429307,3722699582,1580150641,327451799,2790478837,3117535592,0,3253595436,1075847264,3825007647,2041688520,3059440621,3563743934,2378943302,1740553945,1916352843,2487896798,2555137236,2958579944,2244988746,3151024235,3320835882,1336584933,3992714006,2252555205,2588757463,1714631509,293963156,2319795663,3925473552,67240454,4269768577,2689618160,2017213508,631218106,1269344483,2723238387,1571005438,2151694528,93294474,1066570413,563977660,1882732616,4059428100,1673313503,2008463041,2950355573,1109467491,537923632,3858759450,4260623118,3218264685,2177748300,403442708,638784309,3287084079,3193921505,899127202,2286175436,773265209,2479146071,1437050866,4236148354,2050833735,3362022572,3126681063,840505643,3866325909,3227541664,427917720,2655997905,2749160575,1143087718,1412049534,999329963,193497219,2353415882,3354324521,1807268051,672404540,2816401017,3160301282,369822493,2916866934,3688947771,1681011286,1949973070,336202270,2454276571,201721354,1210328172,3093060836,2680341085,3184776046,1135389935,3294782118,965841320,831886756,3554993207,4068047243,3588745010,2345191491,1849112409,3664604599,26054028,2983581028,2622377682,1235855840,3630984372,2891339514,4092916743,3488279077,3395642799,4101667470,1202630377,268961816,1874508501,4034427016,1243948399,1546530418,941366308,1470539505,1941222599,2546386513,3421038627,2715671932,3899946140,1042226977,2521517021,1639824860,227249030,260737669,3765465232,2084453954,1907733956,3429263018,2420656344,100860677,4160157185,470683154,3261161891,1781871967,2924959737,1773779408,394692241,2579611992,974986535,664706745,3655459128,3958962195,731420851,571543859,3530123707,2849626480,126783113,865375399,765172662,1008606754,361203602,3387549984,2278477385,2857719295,1344809080,2782912378,59542671,1503764984,160008576,437062935,1707065306,3622233649,2218934982,3496503480,2185314755,697932208,1512910199,504303377,2075177163,2824099068,1841019862,739644986],p=[2781242211,2230877308,2582542199,2381740923,234877682,3184946027,2984144751,1418839493,1348481072,50462977,2848876391,2102799147,434634494,1656084439,3863849899,2599188086,1167051466,2636087938,1082771913,2281340285,368048890,3954334041,3381544775,201060592,3963727277,1739838676,4250903202,3930435503,3206782108,4149453988,2531553906,1536934080,3262494647,484572669,2923271059,1783375398,1517041206,1098792767,49674231,1334037708,1550332980,4098991525,886171109,150598129,2481090929,1940642008,1398944049,1059722517,201851908,1385547719,1699095331,1587397571,674240536,2704774806,252314885,3039795866,151914247,908333586,2602270848,1038082786,651029483,1766729511,3447698098,2682942837,454166793,2652734339,1951935532,775166490,758520603,3000790638,4004797018,4217086112,4137964114,1299594043,1639438038,3464344499,2068982057,1054729187,1901997871,2534638724,4121318227,1757008337,0,750906861,1614815264,535035132,3363418545,3988151131,3201591914,1183697867,3647454910,1265776953,3734260298,3566750796,3903871064,1250283471,1807470800,717615087,3847203498,384695291,3313910595,3617213773,1432761139,2484176261,3481945413,283769337,100925954,2180939647,4037038160,1148730428,3123027871,3813386408,4087501137,4267549603,3229630528,2315620239,2906624658,3156319645,1215313976,82966005,3747855548,3245848246,1974459098,1665278241,807407632,451280895,251524083,1841287890,1283575245,337120268,891687699,801369324,3787349855,2721421207,3431482436,959321879,1469301956,4065699751,2197585534,1199193405,2898814052,3887750493,724703513,2514908019,2696962144,2551808385,3516813135,2141445340,1715741218,2119445034,2872807568,2198571144,3398190662,700968686,3547052216,1009259540,2041044702,3803995742,487983883,1991105499,1004265696,1449407026,1316239930,504629770,3683797321,168560134,1816667172,3837287516,1570751170,1857934291,4014189740,2797888098,2822345105,2754712981,936633572,2347923833,852879335,1133234376,1500395319,3084545389,2348912013,1689376213,3533459022,3762923945,3034082412,4205598294,133428468,634383082,2949277029,2398386810,3913789102,403703816,3580869306,2297460856,1867130149,1918643758,607656988,4049053350,3346248884,1368901318,600565992,2090982877,2632479860,557719327,3717614411,3697393085,2249034635,2232388234,2430627952,1115438654,3295786421,2865522278,3633334344,84280067,33027830,303828494,2747425121,1600795957,4188952407,3496589753,2434238086,1486471617,658119965,3106381470,953803233,334231800,3005978776,857870609,3151128937,1890179545,2298973838,2805175444,3056442267,574365214,2450884487,550103529,1233637070,4289353045,2018519080,2057691103,2399374476,4166623649,2148108681,387583245,3664101311,836232934,3330556482,3100665960,3280093505,2955516313,2002398509,287182607,3413881008,4238890068,3597515707,975967766],v=[1671808611,2089089148,2006576759,2072901243,4061003762,1807603307,1873927791,3310653893,810573872,16974337,1739181671,729634347,4263110654,3613570519,2883997099,1989864566,3393556426,2191335298,3376449993,2106063485,4195741690,1508618841,1204391495,4027317232,2917941677,3563566036,2734514082,2951366063,2629772188,2767672228,1922491506,3227229120,3082974647,4246528509,2477669779,644500518,911895606,1061256767,4144166391,3427763148,878471220,2784252325,3845444069,4043897329,1905517169,3631459288,827548209,356461077,67897348,3344078279,593839651,3277757891,405286936,2527147926,84871685,2595565466,118033927,305538066,2157648768,3795705826,3945188843,661212711,2999812018,1973414517,152769033,2208177539,745822252,439235610,455947803,1857215598,1525593178,2700827552,1391895634,994932283,3596728278,3016654259,695947817,3812548067,795958831,2224493444,1408607827,3513301457,0,3979133421,543178784,4229948412,2982705585,1542305371,1790891114,3410398667,3201918910,961245753,1256100938,1289001036,1491644504,3477767631,3496721360,4012557807,2867154858,4212583931,1137018435,1305975373,861234739,2241073541,1171229253,4178635257,33948674,2139225727,1357946960,1011120188,2679776671,2833468328,1374921297,2751356323,1086357568,2408187279,2460827538,2646352285,944271416,4110742005,3168756668,3066132406,3665145818,560153121,271589392,4279952895,4077846003,3530407890,3444343245,202643468,322250259,3962553324,1608629855,2543990167,1154254916,389623319,3294073796,2817676711,2122513534,1028094525,1689045092,1575467613,422261273,1939203699,1621147744,2174228865,1339137615,3699352540,577127458,712922154,2427141008,2290289544,1187679302,3995715566,3100863416,339486740,3732514782,1591917662,186455563,3681988059,3762019296,844522546,978220090,169743370,1239126601,101321734,611076132,1558493276,3260915650,3547250131,2901361580,1655096418,2443721105,2510565781,3828863972,2039214713,3878868455,3359869896,928607799,1840765549,2374762893,3580146133,1322425422,2850048425,1823791212,1459268694,4094161908,3928346602,1706019429,2056189050,2934523822,135794696,3134549946,2022240376,628050469,779246638,472135708,2800834470,3032970164,3327236038,3894660072,3715932637,1956440180,522272287,1272813131,3185336765,2340818315,2323976074,1888542832,1044544574,3049550261,1722469478,1222152264,50660867,4127324150,236067854,1638122081,895445557,1475980887,3117443513,2257655686,3243809217,489110045,2662934430,3778599393,4162055160,2561878936,288563729,1773916777,3648039385,2391345038,2493985684,2612407707,505560094,2274497927,3911240169,3460925390,1442818645,678973480,3749357023,2358182796,2717407649,2306869641,219617805,3218761151,3862026214,1120306242,1756942440,1103331905,2578459033,762796589,252780047,2966125488,1425844308,3151392187,372911126],m=[1667474886,2088535288,2004326894,2071694838,4075949567,1802223062,1869591006,3318043793,808472672,16843522,1734846926,724270422,4278065639,3621216949,2880169549,1987484396,3402253711,2189597983,3385409673,2105378810,4210693615,1499065266,1195886990,4042263547,2913856577,3570689971,2728590687,2947541573,2627518243,2762274643,1920112356,3233831835,3082273397,4261223649,2475929149,640051788,909531756,1061110142,4160160501,3435941763,875846760,2779116625,3857003729,4059105529,1903268834,3638064043,825316194,353713962,67374088,3351728789,589522246,3284360861,404236336,2526454071,84217610,2593830191,117901582,303183396,2155911963,3806477791,3958056653,656894286,2998062463,1970642922,151591698,2206440989,741110872,437923380,454765878,1852748508,1515908788,2694904667,1381168804,993742198,3604373943,3014905469,690584402,3823320797,791638366,2223281939,1398011302,3520161977,0,3991743681,538992704,4244381667,2981218425,1532751286,1785380564,3419096717,3200178535,960056178,1246420628,1280103576,1482221744,3486468741,3503319995,4025428677,2863326543,4227536621,1128514950,1296947098,859002214,2240123921,1162203018,4193849577,33687044,2139062782,1347481760,1010582648,2678045221,2829640523,1364325282,2745433693,1077985408,2408548869,2459086143,2644360225,943212656,4126475505,3166494563,3065430391,3671750063,555836226,269496352,4294908645,4092792573,3537006015,3452783745,202118168,320025894,3974901699,1600119230,2543297077,1145359496,387397934,3301201811,2812801621,2122220284,1027426170,1684319432,1566435258,421079858,1936954854,1616945344,2172753945,1330631070,3705438115,572679748,707427924,2425400123,2290647819,1179044492,4008585671,3099120491,336870440,3739122087,1583276732,185277718,3688593069,3772791771,842159716,976899700,168435220,1229577106,101059084,606366792,1549591736,3267517855,3553849021,2897014595,1650632388,2442242105,2509612081,3840161747,2038008818,3890688725,3368567691,926374254,1835907034,2374863873,3587531953,1313788572,2846482505,1819063512,1448540844,4109633523,3941213647,1701162954,2054852340,2930698567,134748176,3132806511,2021165296,623210314,774795868,471606328,2795958615,3031746419,3334885783,3907527627,3722280097,1953799400,522133822,1263263126,3183336545,2341176845,2324333839,1886425312,1044267644,3048588401,1718004428,1212733584,50529542,4143317495,235803164,1633788866,892690282,1465383342,3115962473,2256965911,3250673817,488449850,2661202215,3789633753,4177007595,2560144171,286339874,1768537042,3654906025,2391705863,2492770099,2610673197,505291324,2273808917,3924369609,3469625735,1431699370,673740880,3755965093,2358021891,2711746649,2307489801,218961690,3217021541,3873845719,1111672452,1751693520,1094828930,2576986153,757954394,252645662,2964376443,1414855848,3149649517,370555436],y=[1374988112,2118214995,437757123,975658646,1001089995,530400753,2902087851,1273168787,540080725,2910219766,2295101073,4110568485,1340463100,3307916247,641025152,3043140495,3736164937,632953703,1172967064,1576976609,3274667266,2169303058,2370213795,1809054150,59727847,361929877,3211623147,2505202138,3569255213,1484005843,1239443753,2395588676,1975683434,4102977912,2572697195,666464733,3202437046,4035489047,3374361702,2110667444,1675577880,3843699074,2538681184,1649639237,2976151520,3144396420,4269907996,4178062228,1883793496,2403728665,2497604743,1383856311,2876494627,1917518562,3810496343,1716890410,3001755655,800440835,2261089178,3543599269,807962610,599762354,33778362,3977675356,2328828971,2809771154,4077384432,1315562145,1708848333,101039829,3509871135,3299278474,875451293,2733856160,92987698,2767645557,193195065,1080094634,1584504582,3178106961,1042385657,2531067453,3711829422,1306967366,2438237621,1908694277,67556463,1615861247,429456164,3602770327,2302690252,1742315127,2968011453,126454664,3877198648,2043211483,2709260871,2084704233,4169408201,0,159417987,841739592,504459436,1817866830,4245618683,260388950,1034867998,908933415,168810852,1750902305,2606453969,607530554,202008497,2472011535,3035535058,463180190,2160117071,1641816226,1517767529,470948374,3801332234,3231722213,1008918595,303765277,235474187,4069246893,766945465,337553864,1475418501,2943682380,4003061179,2743034109,4144047775,1551037884,1147550661,1543208500,2336434550,3408119516,3069049960,3102011747,3610369226,1113818384,328671808,2227573024,2236228733,3535486456,2935566865,3341394285,496906059,3702665459,226906860,2009195472,733156972,2842737049,294930682,1206477858,2835123396,2700099354,1451044056,573804783,2269728455,3644379585,2362090238,2564033334,2801107407,2776292904,3669462566,1068351396,742039012,1350078989,1784663195,1417561698,4136440770,2430122216,775550814,2193862645,2673705150,1775276924,1876241833,3475313331,3366754619,270040487,3902563182,3678124923,3441850377,1851332852,3969562369,2203032232,3868552805,2868897406,566021896,4011190502,3135740889,1248802510,3936291284,699432150,832877231,708780849,3332740144,899835584,1951317047,4236429990,3767586992,866637845,4043610186,1106041591,2144161806,395441711,1984812685,1139781709,3433712980,3835036895,2664543715,1282050075,3240894392,1181045119,2640243204,25965917,4203181171,4211818798,3009879386,2463879762,3910161971,1842759443,2597806476,933301370,1509430414,3943906441,3467192302,3076639029,3776767469,2051518780,2631065433,1441952575,404016761,1942435775,1408749034,1610459739,3745345300,2017778566,3400528769,3110650942,941896748,3265478751,371049330,3168937228,675039627,4279080257,967311729,135050206,3635733660,1683407248,2076935265,3576870512,1215061108,3501741890],g=[1347548327,1400783205,3273267108,2520393566,3409685355,4045380933,2880240216,2471224067,1428173050,4138563181,2441661558,636813900,4233094615,3620022987,2149987652,2411029155,1239331162,1730525723,2554718734,3781033664,46346101,310463728,2743944855,3328955385,3875770207,2501218972,3955191162,3667219033,768917123,3545789473,692707433,1150208456,1786102409,2029293177,1805211710,3710368113,3065962831,401639597,1724457132,3028143674,409198410,2196052529,1620529459,1164071807,3769721975,2226875310,486441376,2499348523,1483753576,428819965,2274680428,3075636216,598438867,3799141122,1474502543,711349675,129166120,53458370,2592523643,2782082824,4063242375,2988687269,3120694122,1559041666,730517276,2460449204,4042459122,2706270690,3446004468,3573941694,533804130,2328143614,2637442643,2695033685,839224033,1973745387,957055980,2856345839,106852767,1371368976,4181598602,1033297158,2933734917,1179510461,3046200461,91341917,1862534868,4284502037,605657339,2547432937,3431546947,2003294622,3182487618,2282195339,954669403,3682191598,1201765386,3917234703,3388507166,0,2198438022,1211247597,2887651696,1315723890,4227665663,1443857720,507358933,657861945,1678381017,560487590,3516619604,975451694,2970356327,261314535,3535072918,2652609425,1333838021,2724322336,1767536459,370938394,182621114,3854606378,1128014560,487725847,185469197,2918353863,3106780840,3356761769,2237133081,1286567175,3152976349,4255350624,2683765030,3160175349,3309594171,878443390,1988838185,3704300486,1756818940,1673061617,3403100636,272786309,1075025698,545572369,2105887268,4174560061,296679730,1841768865,1260232239,4091327024,3960309330,3497509347,1814803222,2578018489,4195456072,575138148,3299409036,446754879,3629546796,4011996048,3347532110,3252238545,4270639778,915985419,3483825537,681933534,651868046,2755636671,3828103837,223377554,2607439820,1649704518,3270937875,3901806776,1580087799,4118987695,3198115200,2087309459,2842678573,3016697106,1003007129,2802849917,1860738147,2077965243,164439672,4100872472,32283319,2827177882,1709610350,2125135846,136428751,3874428392,3652904859,3460984630,3572145929,3593056380,2939266226,824852259,818324884,3224740454,930369212,2801566410,2967507152,355706840,1257309336,4148292826,243256656,790073846,2373340630,1296297904,1422699085,3756299780,3818836405,457992840,3099667487,2135319889,77422314,1560382517,1945798516,788204353,1521706781,1385356242,870912086,325965383,2358957921,2050466060,2388260884,2313884476,4006521127,901210569,3990953189,1014646705,1503449823,1062597235,2031621326,3212035895,3931371469,1533017514,350174575,2256028891,2177544179,1052338372,741876788,1606591296,1914052035,213705253,2334669897,1107234197,1899603969,3725069491,2631447780,2422494913,1635502980,1893020342,1950903388,1120974935],b=[2807058932,1699970625,2764249623,1586903591,1808481195,1173430173,1487645946,59984867,4199882800,1844882806,1989249228,1277555970,3623636965,3419915562,1149249077,2744104290,1514790577,459744698,244860394,3235995134,1963115311,4027744588,2544078150,4190530515,1608975247,2627016082,2062270317,1507497298,2200818878,567498868,1764313568,3359936201,2305455554,2037970062,1047239e3,1910319033,1337376481,2904027272,2892417312,984907214,1243112415,830661914,861968209,2135253587,2011214180,2927934315,2686254721,731183368,1750626376,4246310725,1820824798,4172763771,3542330227,48394827,2404901663,2871682645,671593195,3254988725,2073724613,145085239,2280796200,2779915199,1790575107,2187128086,472615631,3029510009,4075877127,3802222185,4107101658,3201631749,1646252340,4270507174,1402811438,1436590835,3778151818,3950355702,3963161475,4020912224,2667994737,273792366,2331590177,104699613,95345982,3175501286,2377486676,1560637892,3564045318,369057872,4213447064,3919042237,1137477952,2658625497,1119727848,2340947849,1530455833,4007360968,172466556,266959938,516552836,0,2256734592,3980931627,1890328081,1917742170,4294704398,945164165,3575528878,958871085,3647212047,2787207260,1423022939,775562294,1739656202,3876557655,2530391278,2443058075,3310321856,547512796,1265195639,437656594,3121275539,719700128,3762502690,387781147,218828297,3350065803,2830708150,2848461854,428169201,122466165,3720081049,1627235199,648017665,4122762354,1002783846,2117360635,695634755,3336358691,4234721005,4049844452,3704280881,2232435299,574624663,287343814,612205898,1039717051,840019705,2708326185,793451934,821288114,1391201670,3822090177,376187827,3113855344,1224348052,1679968233,2361698556,1058709744,752375421,2431590963,1321699145,3519142200,2734591178,188127444,2177869557,3727205754,2384911031,3215212461,2648976442,2450346104,3432737375,1180849278,331544205,3102249176,4150144569,2952102595,2159976285,2474404304,766078933,313773861,2570832044,2108100632,1668212892,3145456443,2013908262,418672217,3070356634,2594734927,1852171925,3867060991,3473416636,3907448597,2614737639,919489135,164948639,2094410160,2997825956,590424639,2486224549,1723872674,3157750862,3399941250,3501252752,3625268135,2555048196,3673637356,1343127501,4130281361,3599595085,2957853679,1297403050,81781910,3051593425,2283490410,532201772,1367295589,3926170974,895287692,1953757831,1093597963,492483431,3528626907,1446242576,1192455638,1636604631,209336225,344873464,1015671571,669961897,3375740769,3857572124,2973530695,3747192018,1933530610,3464042516,935293895,3454686199,2858115069,1863638845,3683022916,4085369519,3292445032,875313188,1080017571,3279033885,621591778,1233856572,2504130317,24197544,3017672716,3835484340,3247465558,2220981195,3060847922,1551124588,1463996600],w=[4104605777,1097159550,396673818,660510266,2875968315,2638606623,4200115116,3808662347,821712160,1986918061,3430322568,38544885,3856137295,718002117,893681702,1654886325,2975484382,3122358053,3926825029,4274053469,796197571,1290801793,1184342925,3556361835,2405426947,2459735317,1836772287,1381620373,3196267988,1948373848,3764988233,3385345166,3263785589,2390325492,1480485785,3111247143,3780097726,2293045232,548169417,3459953789,3746175075,439452389,1362321559,1400849762,1685577905,1806599355,2174754046,137073913,1214797936,1174215055,3731654548,2079897426,1943217067,1258480242,529487843,1437280870,3945269170,3049390895,3313212038,923313619,679998e3,3215307299,57326082,377642221,3474729866,2041877159,133361907,1776460110,3673476453,96392454,878845905,2801699524,777231668,4082475170,2330014213,4142626212,2213296395,1626319424,1906247262,1846563261,562755902,3708173718,1040559837,3871163981,1418573201,3294430577,114585348,1343618912,2566595609,3186202582,1078185097,3651041127,3896688048,2307622919,425408743,3371096953,2081048481,1108339068,2216610296,0,2156299017,736970802,292596766,1517440620,251657213,2235061775,2933202493,758720310,265905162,1554391400,1532285339,908999204,174567692,1474760595,4002861748,2610011675,3234156416,3693126241,2001430874,303699484,2478443234,2687165888,585122620,454499602,151849742,2345119218,3064510765,514443284,4044981591,1963412655,2581445614,2137062819,19308535,1928707164,1715193156,4219352155,1126790795,600235211,3992742070,3841024952,836553431,1669664834,2535604243,3323011204,1243905413,3141400786,4180808110,698445255,2653899549,2989552604,2253581325,3252932727,3004591147,1891211689,2487810577,3915653703,4237083816,4030667424,2100090966,865136418,1229899655,953270745,3399679628,3557504664,4118925222,2061379749,3079546586,2915017791,983426092,2022837584,1607244650,2118541908,2366882550,3635996816,972512814,3283088770,1568718495,3499326569,3576539503,621982671,2895723464,410887952,2623762152,1002142683,645401037,1494807662,2595684844,1335535747,2507040230,4293295786,3167684641,367585007,3885750714,1865862730,2668221674,2960971305,2763173681,1059270954,2777952454,2724642869,1320957812,2194319100,2429595872,2815956275,77089521,3973773121,3444575871,2448830231,1305906550,4021308739,2857194700,2516901860,3518358430,1787304780,740276417,1699839814,1592394909,2352307457,2272556026,188821243,1729977011,3687994002,274084841,3594982253,3613494426,2701949495,4162096729,322734571,2837966542,1640576439,484830689,1202797690,3537852828,4067639125,349075736,3342319475,4157467219,4255800159,1030690015,1155237496,2951971274,1757691577,607398968,2738905026,499347990,3794078908,1011452712,227885567,2818666809,213114376,3034881240,1455525988,3414450555,850817237,1817998408,3092726480],_=[0,235474187,470948374,303765277,941896748,908933415,607530554,708780849,1883793496,2118214995,1817866830,1649639237,1215061108,1181045119,1417561698,1517767529,3767586992,4003061179,4236429990,4069246893,3635733660,3602770327,3299278474,3400528769,2430122216,2664543715,2362090238,2193862645,2835123396,2801107407,3035535058,3135740889,3678124923,3576870512,3341394285,3374361702,3810496343,3977675356,4279080257,4043610186,2876494627,2776292904,3076639029,3110650942,2472011535,2640243204,2403728665,2169303058,1001089995,899835584,666464733,699432150,59727847,226906860,530400753,294930682,1273168787,1172967064,1475418501,1509430414,1942435775,2110667444,1876241833,1641816226,2910219766,2743034109,2976151520,3211623147,2505202138,2606453969,2302690252,2269728455,3711829422,3543599269,3240894392,3475313331,3843699074,3943906441,4178062228,4144047775,1306967366,1139781709,1374988112,1610459739,1975683434,2076935265,1775276924,1742315127,1034867998,866637845,566021896,800440835,92987698,193195065,429456164,395441711,1984812685,2017778566,1784663195,1683407248,1315562145,1080094634,1383856311,1551037884,101039829,135050206,437757123,337553864,1042385657,807962610,573804783,742039012,2531067453,2564033334,2328828971,2227573024,2935566865,2700099354,3001755655,3168937228,3868552805,3902563182,4203181171,4102977912,3736164937,3501741890,3265478751,3433712980,1106041591,1340463100,1576976609,1408749034,2043211483,2009195472,1708848333,1809054150,832877231,1068351396,766945465,599762354,159417987,126454664,361929877,463180190,2709260871,2943682380,3178106961,3009879386,2572697195,2538681184,2236228733,2336434550,3509871135,3745345300,3441850377,3274667266,3910161971,3877198648,4110568485,4211818798,2597806476,2497604743,2261089178,2295101073,2733856160,2902087851,3202437046,2968011453,3936291284,3835036895,4136440770,4169408201,3535486456,3702665459,3467192302,3231722213,2051518780,1951317047,1716890410,1750902305,1113818384,1282050075,1584504582,1350078989,168810852,67556463,371049330,404016761,841739592,1008918595,775550814,540080725,3969562369,3801332234,4035489047,4269907996,3569255213,3669462566,3366754619,3332740144,2631065433,2463879762,2160117071,2395588676,2767645557,2868897406,3102011747,3069049960,202008497,33778362,270040487,504459436,875451293,975658646,675039627,641025152,2084704233,1917518562,1615861247,1851332852,1147550661,1248802510,1484005843,1451044056,933301370,967311729,733156972,632953703,260388950,25965917,328671808,496906059,1206477858,1239443753,1543208500,1441952575,2144161806,1908694277,1675577880,1842759443,3610369226,3644379585,3408119516,3307916247,4011190502,3776767469,4077384432,4245618683,2809771154,2842737049,3144396420,3043140495,2673705150,2438237621,2203032232,2370213795],M=[0,185469197,370938394,487725847,741876788,657861945,975451694,824852259,1483753576,1400783205,1315723890,1164071807,1950903388,2135319889,1649704518,1767536459,2967507152,3152976349,2801566410,2918353863,2631447780,2547432937,2328143614,2177544179,3901806776,3818836405,4270639778,4118987695,3299409036,3483825537,3535072918,3652904859,2077965243,1893020342,1841768865,1724457132,1474502543,1559041666,1107234197,1257309336,598438867,681933534,901210569,1052338372,261314535,77422314,428819965,310463728,3409685355,3224740454,3710368113,3593056380,3875770207,3960309330,4045380933,4195456072,2471224067,2554718734,2237133081,2388260884,3212035895,3028143674,2842678573,2724322336,4138563181,4255350624,3769721975,3955191162,3667219033,3516619604,3431546947,3347532110,2933734917,2782082824,3099667487,3016697106,2196052529,2313884476,2499348523,2683765030,1179510461,1296297904,1347548327,1533017514,1786102409,1635502980,2087309459,2003294622,507358933,355706840,136428751,53458370,839224033,957055980,605657339,790073846,2373340630,2256028891,2607439820,2422494913,2706270690,2856345839,3075636216,3160175349,3573941694,3725069491,3273267108,3356761769,4181598602,4063242375,4011996048,3828103837,1033297158,915985419,730517276,545572369,296679730,446754879,129166120,213705253,1709610350,1860738147,1945798516,2029293177,1239331162,1120974935,1606591296,1422699085,4148292826,4233094615,3781033664,3931371469,3682191598,3497509347,3446004468,3328955385,2939266226,2755636671,3106780840,2988687269,2198438022,2282195339,2501218972,2652609425,1201765386,1286567175,1371368976,1521706781,1805211710,1620529459,2105887268,1988838185,533804130,350174575,164439672,46346101,870912086,954669403,636813900,788204353,2358957921,2274680428,2592523643,2441661558,2695033685,2880240216,3065962831,3182487618,3572145929,3756299780,3270937875,3388507166,4174560061,4091327024,4006521127,3854606378,1014646705,930369212,711349675,560487590,272786309,457992840,106852767,223377554,1678381017,1862534868,1914052035,2031621326,1211247597,1128014560,1580087799,1428173050,32283319,182621114,401639597,486441376,768917123,651868046,1003007129,818324884,1503449823,1385356242,1333838021,1150208456,1973745387,2125135846,1673061617,1756818940,2970356327,3120694122,2802849917,2887651696,2637442643,2520393566,2334669897,2149987652,3917234703,3799141122,4284502037,4100872472,3309594171,3460984630,3545789473,3629546796,2050466060,1899603969,1814803222,1730525723,1443857720,1560382517,1075025698,1260232239,575138148,692707433,878443390,1062597235,243256656,91341917,409198410,325965383,3403100636,3252238545,3704300486,3620022987,3874428392,3990953189,4042459122,4227665663,2460449204,2578018489,2226875310,2411029155,3198115200,3046200461,2827177882,2743944855],A=[0,218828297,437656594,387781147,875313188,958871085,775562294,590424639,1750626376,1699970625,1917742170,2135253587,1551124588,1367295589,1180849278,1265195639,3501252752,3720081049,3399941250,3350065803,3835484340,3919042237,4270507174,4085369519,3102249176,3051593425,2734591178,2952102595,2361698556,2177869557,2530391278,2614737639,3145456443,3060847922,2708326185,2892417312,2404901663,2187128086,2504130317,2555048196,3542330227,3727205754,3375740769,3292445032,3876557655,3926170974,4246310725,4027744588,1808481195,1723872674,1910319033,2094410160,1608975247,1391201670,1173430173,1224348052,59984867,244860394,428169201,344873464,935293895,984907214,766078933,547512796,1844882806,1627235199,2011214180,2062270317,1507497298,1423022939,1137477952,1321699145,95345982,145085239,532201772,313773861,830661914,1015671571,731183368,648017665,3175501286,2957853679,2807058932,2858115069,2305455554,2220981195,2474404304,2658625497,3575528878,3625268135,3473416636,3254988725,3778151818,3963161475,4213447064,4130281361,3599595085,3683022916,3432737375,3247465558,3802222185,4020912224,4172763771,4122762354,3201631749,3017672716,2764249623,2848461854,2331590177,2280796200,2431590963,2648976442,104699613,188127444,472615631,287343814,840019705,1058709744,671593195,621591778,1852171925,1668212892,1953757831,2037970062,1514790577,1463996600,1080017571,1297403050,3673637356,3623636965,3235995134,3454686199,4007360968,3822090177,4107101658,4190530515,2997825956,3215212461,2830708150,2779915199,2256734592,2340947849,2627016082,2443058075,172466556,122466165,273792366,492483431,1047239e3,861968209,612205898,695634755,1646252340,1863638845,2013908262,1963115311,1446242576,1530455833,1277555970,1093597963,1636604631,1820824798,2073724613,1989249228,1436590835,1487645946,1337376481,1119727848,164948639,81781910,331544205,516552836,1039717051,821288114,669961897,719700128,2973530695,3157750862,2871682645,2787207260,2232435299,2283490410,2667994737,2450346104,3647212047,3564045318,3279033885,3464042516,3980931627,3762502690,4150144569,4199882800,3070356634,3121275539,2904027272,2686254721,2200818878,2384911031,2570832044,2486224549,3747192018,3528626907,3310321856,3359936201,3950355702,3867060991,4049844452,4234721005,1739656202,1790575107,2108100632,1890328081,1402811438,1586903591,1233856572,1149249077,266959938,48394827,369057872,418672217,1002783846,919489135,567498868,752375421,209336225,24197544,376187827,459744698,945164165,895287692,574624663,793451934,1679968233,1764313568,2117360635,1933530610,1343127501,1560637892,1243112415,1192455638,3704280881,3519142200,3336358691,3419915562,3907448597,3857572124,4075877127,4294704398,3029510009,3113855344,2927934315,2744104290,2159976285,2377486676,2594734927,2544078150],E=[0,151849742,303699484,454499602,607398968,758720310,908999204,1059270954,1214797936,1097159550,1517440620,1400849762,1817998408,1699839814,2118541908,2001430874,2429595872,2581445614,2194319100,2345119218,3034881240,3186202582,2801699524,2951971274,3635996816,3518358430,3399679628,3283088770,4237083816,4118925222,4002861748,3885750714,1002142683,850817237,698445255,548169417,529487843,377642221,227885567,77089521,1943217067,2061379749,1640576439,1757691577,1474760595,1592394909,1174215055,1290801793,2875968315,2724642869,3111247143,2960971305,2405426947,2253581325,2638606623,2487810577,3808662347,3926825029,4044981591,4162096729,3342319475,3459953789,3576539503,3693126241,1986918061,2137062819,1685577905,1836772287,1381620373,1532285339,1078185097,1229899655,1040559837,923313619,740276417,621982671,439452389,322734571,137073913,19308535,3871163981,4021308739,4104605777,4255800159,3263785589,3414450555,3499326569,3651041127,2933202493,2815956275,3167684641,3049390895,2330014213,2213296395,2566595609,2448830231,1305906550,1155237496,1607244650,1455525988,1776460110,1626319424,2079897426,1928707164,96392454,213114376,396673818,514443284,562755902,679998e3,865136418,983426092,3708173718,3557504664,3474729866,3323011204,4180808110,4030667424,3945269170,3794078908,2507040230,2623762152,2272556026,2390325492,2975484382,3092726480,2738905026,2857194700,3973773121,3856137295,4274053469,4157467219,3371096953,3252932727,3673476453,3556361835,2763173681,2915017791,3064510765,3215307299,2156299017,2307622919,2459735317,2610011675,2081048481,1963412655,1846563261,1729977011,1480485785,1362321559,1243905413,1126790795,878845905,1030690015,645401037,796197571,274084841,425408743,38544885,188821243,3613494426,3731654548,3313212038,3430322568,4082475170,4200115116,3780097726,3896688048,2668221674,2516901860,2366882550,2216610296,3141400786,2989552604,2837966542,2687165888,1202797690,1320957812,1437280870,1554391400,1669664834,1787304780,1906247262,2022837584,265905162,114585348,499347990,349075736,736970802,585122620,972512814,821712160,2595684844,2478443234,2293045232,2174754046,3196267988,3079546586,2895723464,2777952454,3537852828,3687994002,3234156416,3385345166,4142626212,4293295786,3841024952,3992742070,174567692,57326082,410887952,292596766,777231668,660510266,1011452712,893681702,1108339068,1258480242,1343618912,1494807662,1715193156,1865862730,1948373848,2100090966,2701949495,2818666809,3004591147,3122358053,2235061775,2352307457,2535604243,2653899549,3915653703,3764988233,4219352155,4067639125,3444575871,3294430577,3746175075,3594982253,836553431,953270745,600235211,718002117,367585007,484830689,133361907,251657213,2041877159,1891211689,1806599355,1654886325,1568718495,1418573201,1335535747,1184342925];function S(e){for(var t=[],r=0;r<e.length;r+=4)t.push(e[r]<<24|e[r+1]<<16|e[r+2]<<8|e[r+3]);return t}var k=function(e){if(!(this instanceof k))throw Error("AES must be instanitated with `new`");Object.defineProperty(this,"key",{value:o(e,!0)}),this._prepare()};k.prototype._prepare=function(){var e=h[this.key.length];if(null==e)throw new Error("invalid key size (must be 16, 24 or 32 bytes)");this._Ke=[],this._Kd=[];for(var t=0;t<=e;t++)this._Ke.push([0,0,0,0]),this._Kd.push([0,0,0,0]);var r,n=4*(e+1),i=this.key.length/4,o=S(this.key);for(t=0;t<i;t++)r=t>>2,this._Ke[r][t%4]=o[t],this._Kd[e-r][t%4]=o[t];for(var s,a=0,u=i;u<n;){if(s=o[i-1],o[0]^=d[s>>16&255]<<24^d[s>>8&255]<<16^d[255&s]<<8^d[s>>24&255]^c[a]<<24,a+=1,8!=i)for(t=1;t<i;t++)o[t]^=o[t-1];else{for(t=1;t<i/2;t++)o[t]^=o[t-1];s=o[i/2-1],o[i/2]^=d[255&s]^d[s>>8&255]<<8^d[s>>16&255]<<16^d[s>>24&255]<<24;for(t=i/2+1;t<i;t++)o[t]^=o[t-1]}for(t=0;t<i&&u<n;)l=u>>2,f=u%4,this._Ke[l][f]=o[t],this._Kd[e-l][f]=o[t++],u++}for(var l=1;l<e;l++)for(var f=0;f<4;f++)s=this._Kd[l][f],this._Kd[l][f]=_[s>>24&255]^M[s>>16&255]^A[s>>8&255]^E[255&s]},k.prototype.encrypt=function(e){if(16!=e.length)throw new Error("invalid plaintext size (must be 16 bytes)");for(var t=this._Ke.length-1,r=[0,0,0,0],n=S(e),i=0;i<4;i++)n[i]^=this._Ke[0][i];for(var o=1;o<t;o++){for(i=0;i<4;i++)r[i]=f[n[i]>>24&255]^p[n[(i+1)%4]>>16&255]^v[n[(i+2)%4]>>8&255]^m[255&n[(i+3)%4]]^this._Ke[o][i];n=r.slice()}var s,a=u(16);for(i=0;i<4;i++)s=this._Ke[t][i],a[4*i]=255&(d[n[i]>>24&255]^s>>24),a[4*i+1]=255&(d[n[(i+1)%4]>>16&255]^s>>16),a[4*i+2]=255&(d[n[(i+2)%4]>>8&255]^s>>8),a[4*i+3]=255&(d[255&n[(i+3)%4]]^s);return a},k.prototype.decrypt=function(e){if(16!=e.length)throw new Error("invalid ciphertext size (must be 16 bytes)");for(var t=this._Kd.length-1,r=[0,0,0,0],n=S(e),i=0;i<4;i++)n[i]^=this._Kd[0][i];for(var o=1;o<t;o++){for(i=0;i<4;i++)r[i]=y[n[i]>>24&255]^g[n[(i+3)%4]>>16&255]^b[n[(i+2)%4]>>8&255]^w[255&n[(i+1)%4]]^this._Kd[o][i];n=r.slice()}var s,a=u(16);for(i=0;i<4;i++)s=this._Kd[t][i],a[4*i]=255&(l[n[i]>>24&255]^s>>24),a[4*i+1]=255&(l[n[(i+3)%4]>>16&255]^s>>16),a[4*i+2]=255&(l[n[(i+2)%4]>>8&255]^s>>8),a[4*i+3]=255&(l[255&n[(i+1)%4]]^s);return a};var N=function(e){if(!(this instanceof N))throw Error("AES must be instanitated with `new`");this.description="Electronic Code Block",this.name="ecb",this._aes=new k(e)};N.prototype.encrypt=function(e){if((e=o(e)).length%16!=0)throw new Error("invalid plaintext size (must be multiple of 16 bytes)");for(var t=u(e.length),r=u(16),n=0;n<e.length;n+=16)s(e,r,0,n,n+16),s(r=this._aes.encrypt(r),t,n);return t},N.prototype.decrypt=function(e){if((e=o(e)).length%16!=0)throw new Error("invalid ciphertext size (must be multiple of 16 bytes)");for(var t=u(e.length),r=u(16),n=0;n<e.length;n+=16)s(e,r,0,n,n+16),s(r=this._aes.decrypt(r),t,n);return t};var P=function(e,t){if(!(this instanceof P))throw Error("AES must be instanitated with `new`");if(this.description="Cipher Block Chaining",this.name="cbc",t){if(16!=t.length)throw new Error("invalid initialation vector size (must be 16 bytes)")}else t=u(16);this._lastCipherblock=o(t,!0),this._aes=new k(e)};P.prototype.encrypt=function(e){if((e=o(e)).length%16!=0)throw new Error("invalid plaintext size (must be multiple of 16 bytes)");for(var t=u(e.length),r=u(16),n=0;n<e.length;n+=16){s(e,r,0,n,n+16);for(var i=0;i<16;i++)r[i]^=this._lastCipherblock[i];this._lastCipherblock=this._aes.encrypt(r),s(this._lastCipherblock,t,n)}return t},P.prototype.decrypt=function(e){if((e=o(e)).length%16!=0)throw new Error("invalid ciphertext size (must be multiple of 16 bytes)");for(var t=u(e.length),r=u(16),n=0;n<e.length;n+=16){s(e,r,0,n,n+16),r=this._aes.decrypt(r);for(var i=0;i<16;i++)t[n+i]=r[i]^this._lastCipherblock[i];s(e,this._lastCipherblock,0,n,n+16)}return t};var x=function(e,t,r){if(!(this instanceof x))throw Error("AES must be instanitated with `new`");if(this.description="Cipher Feedback",this.name="cfb",t){if(16!=t.length)throw new Error("invalid initialation vector size (must be 16 size)")}else t=u(16);r||(r=1),this.segmentSize=r,this._shiftRegister=o(t,!0),this._aes=new k(e)};x.prototype.encrypt=function(e){if(e.length%this.segmentSize!=0)throw new Error("invalid plaintext size (must be segmentSize bytes)");for(var t,r=o(e,!0),n=0;n<r.length;n+=this.segmentSize){t=this._aes.encrypt(this._shiftRegister);for(var i=0;i<this.segmentSize;i++)r[n+i]^=t[i];s(this._shiftRegister,this._shiftRegister,0,this.segmentSize),s(r,this._shiftRegister,16-this.segmentSize,n,n+this.segmentSize)}return r},x.prototype.decrypt=function(e){if(e.length%this.segmentSize!=0)throw new Error("invalid ciphertext size (must be segmentSize bytes)");for(var t,r=o(e,!0),n=0;n<r.length;n+=this.segmentSize){t=this._aes.encrypt(this._shiftRegister);for(var i=0;i<this.segmentSize;i++)r[n+i]^=t[i];s(this._shiftRegister,this._shiftRegister,0,this.segmentSize),s(e,this._shiftRegister,16-this.segmentSize,n,n+this.segmentSize)}return r};var I=function(e,t){if(!(this instanceof I))throw Error("AES must be instanitated with `new`");if(this.description="Output Feedback",this.name="ofb",t){if(16!=t.length)throw new Error("invalid initialation vector size (must be 16 bytes)")}else t=u(16);this._lastPrecipher=o(t,!0),this._lastPrecipherIndex=16,this._aes=new k(e)};I.prototype.encrypt=function(e){for(var t=o(e,!0),r=0;r<t.length;r++)16===this._lastPrecipherIndex&&(this._lastPrecipher=this._aes.encrypt(this._lastPrecipher),this._lastPrecipherIndex=0),t[r]^=this._lastPrecipher[this._lastPrecipherIndex++];return t},I.prototype.decrypt=I.prototype.encrypt;var T=function(e){if(!(this instanceof T))throw Error("Counter must be instanitated with `new`");0===e||e||(e=1),"number"==typeof e?(this._counter=u(16),this.setValue(e)):this.setBytes(e)};T.prototype.setValue=function(e){if("number"!=typeof e||parseInt(e)!=e)throw new Error("invalid counter value (must be an integer)");for(var t=15;0<=t;--t)this._counter[t]=e%256,e>>=8},T.prototype.setBytes=function(e){if(16!=(e=o(e,!0)).length)throw new Error("invalid counter bytes size (must be 16 bytes)");this._counter=e},T.prototype.increment=function(){for(var e=15;0<=e;e--){if(255!==this._counter[e]){this._counter[e]++;break}this._counter[e]=0}};var R=function(e,t){if(!(this instanceof R))throw Error("AES must be instanitated with `new`");this.description="Counter",this.name="ctr",t instanceof T||(t=new T(t)),this._counter=t,this._remainingCounter=null,this._remainingCounterIndex=16,this._aes=new k(e)};R.prototype.encrypt=function(e){for(var t=o(e,!0),r=0;r<t.length;r++)16===this._remainingCounterIndex&&(this._remainingCounter=this._aes.encrypt(this._counter._counter),this._remainingCounterIndex=0,this._counter.increment()),t[r]^=this._remainingCounter[this._remainingCounterIndex++];return t},R.prototype.decrypt=R.prototype.encrypt;var O={AES:k,Counter:T,ModeOfOperation:{ecb:N,cbc:P,cfb:x,ofb:I,ctr:R},utils:{hex:a,utf8:t},padding:{pkcs7:{pad:function(e){var t=16-(e=o(e,!0)).length%16,r=u(e.length+t);s(e,r);for(var n=e.length;n<r.length;n++)r[n]=t;return r},strip:function(e){if((e=o(e,!0)).length<16)throw new Error("PKCS#7 invalid length");var t=e[e.length-1];if(16<t)throw new Error("PKCS#7 padding byte out of range");for(var r=e.length-t,n=0;n<t;n++)if(e[r+n]!==t)throw new Error("PKCS#7 invalid padding byte");var i=u(r);return s(e,i,0,0,r),i}}},_arrayTest:{coerceArray:o,createArray:u,copyArray:s}};void 0!==B?C.exports=O:(e.aesjs&&(O._aesjs=e.aesjs),e.aesjs=O)}(this)},{}],9:[function(A,e,t){!function(e,t){"use strict";function m(e,t){if(!e)throw new Error(t||"Assertion failed")}function r(e,t){e.super_=t;var r=function(){};r.prototype=t.prototype,e.prototype=new r,e.prototype.constructor=e}function y(e,t,r){if(y.isBN(e))return e;this.negative=0,this.words=null,this.length=0,(this.red=null)!==e&&("le"!==t&&"be"!==t||(r=t,t=10),this._init(e||0,t||10,r||"be"))}var n;"object"==typeof e?e.exports=y:t.BN=y,(y.BN=y).wordSize=26;try{n=A("buffer").Buffer}catch(e){}function s(e,t,r){for(var n=0,i=Math.min(e.length,r),o=t;o<i;o++){var s=e.charCodeAt(o)-48;n<<=4,n|=49<=s&&s<=54?s-49+10:17<=s&&s<=22?s-17+10:15&s}return n}function h(e,t,r,n){for(var i=0,o=Math.min(e.length,r),s=t;s<o;s++){var a=e.charCodeAt(s)-48;i*=n,i+=49<=a?a-49+10:17<=a?a-17+10:a}return i}y.isBN=function(e){return e instanceof y||null!==e&&"object"==typeof e&&e.constructor.wordSize===y.wordSize&&Array.isArray(e.words)},y.max=function(e,t){return 0<e.cmp(t)?e:t},y.min=function(e,t){return e.cmp(t)<0?e:t},y.prototype._init=function(e,t,r){if("number"==typeof e)return this._initNumber(e,t,r);if("object"==typeof e)return this._initArray(e,t,r);"hex"===t&&(t=16),m(t===(0|t)&&2<=t&&t<=36);var n=0;"-"===(e=e.toString().replace(/\s+/g,""))[0]&&n++,16===t?this._parseHex(e,n):this._parseBase(e,t,n),"-"===e[0]&&(this.negative=1),this.strip(),"le"===r&&this._initArray(this.toArray(),t,r)},y.prototype._initNumber=function(e,t,r){e<0&&(this.negative=1,e=-e),e<67108864?(this.words=[67108863&e],this.length=1):e<4503599627370496?(this.words=[67108863&e,e/67108864&67108863],this.length=2):(m(e<9007199254740992),this.words=[67108863&e,e/67108864&67108863,1],this.length=3),"le"===r&&this._initArray(this.toArray(),t,r)},y.prototype._initArray=function(e,t,r){if(m("number"==typeof e.length),e.length<=0)return this.words=[0],this.length=1,this;this.length=Math.ceil(e.length/3),this.words=new Array(this.length);for(var n=0;n<this.length;n++)this.words[n]=0;var i,o,s=0;if("be"===r)for(n=e.length-1,i=0;0<=n;n-=3)o=e[n]|e[n-1]<<8|e[n-2]<<16,this.words[i]|=o<<s&67108863,this.words[i+1]=o>>>26-s&67108863,26<=(s+=24)&&(s-=26,i++);else if("le"===r)for(i=n=0;n<e.length;n+=3)o=e[n]|e[n+1]<<8|e[n+2]<<16,this.words[i]|=o<<s&67108863,this.words[i+1]=o>>>26-s&67108863,26<=(s+=24)&&(s-=26,i++);return this.strip()},y.prototype._parseHex=function(e,t){this.length=Math.ceil((e.length-t)/6),this.words=new Array(this.length);for(var r=0;r<this.length;r++)this.words[r]=0;var n,i,o=0;for(r=e.length-6,n=0;t<=r;r-=6)i=s(e,r,r+6),this.words[n]|=i<<o&67108863,this.words[n+1]|=i>>>26-o&4194303,26<=(o+=24)&&(o-=26,n++);r+6!==t&&(i=s(e,t,r+6),this.words[n]|=i<<o&67108863,this.words[n+1]|=i>>>26-o&4194303),this.strip()},y.prototype._parseBase=function(e,t,r){this.words=[0];for(var n=0,i=this.length=1;i<=67108863;i*=t)n++;n--,i=i/t|0;for(var o=e.length-r,s=o%n,a=Math.min(o,o-s)+r,u=0,l=r;l<a;l+=n)u=h(e,l,l+n,t),this.imuln(i),this.words[0]+u<67108864?this.words[0]+=u:this._iaddn(u);if(0!==s){var f=1;for(u=h(e,l,e.length,t),l=0;l<s;l++)f*=t;this.imuln(f),this.words[0]+u<67108864?this.words[0]+=u:this._iaddn(u)}},y.prototype.copy=function(e){e.words=new Array(this.length);for(var t=0;t<this.length;t++)e.words[t]=this.words[t];e.length=this.length,e.negative=this.negative,e.red=this.red},y.prototype.clone=function(){var e=new y(null);return this.copy(e),e},y.prototype._expand=function(e){for(;this.length<e;)this.words[this.length++]=0;return this},y.prototype.strip=function(){for(;1<this.length&&0===this.words[this.length-1];)this.length--;return this._normSign()},y.prototype._normSign=function(){return 1===this.length&&0===this.words[0]&&(this.negative=0),this},y.prototype.inspect=function(){return(this.red?"<BN-R: ":"<BN: ")+this.toString(16)+">"};var c=["","0","00","000","0000","00000","000000","0000000","00000000","000000000","0000000000","00000000000","000000000000","0000000000000","00000000000000","000000000000000","0000000000000000","00000000000000000","000000000000000000","0000000000000000000","00000000000000000000","000000000000000000000","0000000000000000000000","00000000000000000000000","000000000000000000000000","0000000000000000000000000"],d=[0,0,25,16,12,11,10,9,8,8,7,7,7,7,6,6,6,6,6,6,6,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5,5],p=[0,0,33554432,43046721,16777216,48828125,60466176,40353607,16777216,43046721,1e7,19487171,35831808,62748517,7529536,11390625,16777216,24137569,34012224,47045881,64e6,4084101,5153632,6436343,7962624,9765625,11881376,14348907,17210368,20511149,243e5,28629151,33554432,39135393,45435424,52521875,60466176];function i(e,t,r){r.negative=t.negative^e.negative;var n=e.length+t.length|0;n=(r.length=n)-1|0;var i=0|e.words[0],o=0|t.words[0],s=i*o,a=67108863&s,u=s/67108864|0;r.words[0]=a;for(var l=1;l<n;l++){for(var f=u>>>26,h=67108863&u,c=Math.min(l,t.length-1),d=Math.max(0,l-e.length+1);d<=c;d++){var p=l-d|0;f+=(s=(i=0|e.words[p])*(o=0|t.words[d])+h)/67108864|0,h=67108863&s}r.words[l]=0|h,u=0|f}return 0!==u?r.words[l]=0|u:r.length--,r.strip()}y.prototype.toString=function(e,t){var r;if(t=0|t||1,16===(e=e||10)||"hex"===e){r="";for(var n=0,i=0,o=0;o<this.length;o++){var s=this.words[o],a=(16777215&(s<<n|i)).toString(16);r=0!==(i=s>>>24-n&16777215)||o!==this.length-1?c[6-a.length]+a+r:a+r,26<=(n+=2)&&(n-=26,o--)}for(0!==i&&(r=i.toString(16)+r);r.length%t!=0;)r="0"+r;return 0!==this.negative&&(r="-"+r),r}if(e===(0|e)&&2<=e&&e<=36){var u=d[e],l=p[e];r="";var f=this.clone();for(f.negative=0;!f.isZero();){var h=f.modn(l).toString(e);r=(f=f.idivn(l)).isZero()?h+r:c[u-h.length]+h+r}for(this.isZero()&&(r="0"+r);r.length%t!=0;)r="0"+r;return 0!==this.negative&&(r="-"+r),r}m(!1,"Base should be between 2 and 36")},y.prototype.toNumber=function(){var e=this.words[0];return 2===this.length?e+=67108864*this.words[1]:3===this.length&&1===this.words[2]?e+=4503599627370496+67108864*this.words[1]:2<this.length&&m(!1,"Number can only safely store up to 53 bits"),0!==this.negative?-e:e},y.prototype.toJSON=function(){return this.toString(16)},y.prototype.toBuffer=function(e,t){return m(void 0!==n),this.toArrayLike(n,e,t)},y.prototype.toArray=function(e,t){return this.toArrayLike(Array,e,t)},y.prototype.toArrayLike=function(e,t,r){var n=this.byteLength(),i=r||Math.max(1,n);m(n<=i,"byte array longer than desired length"),m(0<i,"Requested array length <= 0"),this.strip();var o,s,a="le"===t,u=new e(i),l=this.clone();if(a){for(s=0;!l.isZero();s++)o=l.andln(255),l.iushrn(8),u[s]=o;for(;s<i;s++)u[s]=0}else{for(s=0;s<i-n;s++)u[s]=0;for(s=0;!l.isZero();s++)o=l.andln(255),l.iushrn(8),u[i-s-1]=o}return u},y.prototype._countBits=Math.clz32?function(e){return 32-Math.clz32(e)}:function(e){var t=e,r=0;return 4096<=t&&(r+=13,t>>>=13),64<=t&&(r+=7,t>>>=7),8<=t&&(r+=4,t>>>=4),2<=t&&(r+=2,t>>>=2),r+t},y.prototype._zeroBits=function(e){if(0===e)return 26;var t=e,r=0;return 0==(8191&t)&&(r+=13,t>>>=13),0==(127&t)&&(r+=7,t>>>=7),0==(15&t)&&(r+=4,t>>>=4),0==(3&t)&&(r+=2,t>>>=2),0==(1&t)&&r++,r},y.prototype.bitLength=function(){var e=this.words[this.length-1],t=this._countBits(e);return 26*(this.length-1)+t},y.prototype.zeroBits=function(){if(this.isZero())return 0;for(var e=0,t=0;t<this.length;t++){var r=this._zeroBits(this.words[t]);if(e+=r,26!==r)break}return e},y.prototype.byteLength=function(){return Math.ceil(this.bitLength()/8)},y.prototype.toTwos=function(e){return 0!==this.negative?this.abs().inotn(e).iaddn(1):this.clone()},y.prototype.fromTwos=function(e){return this.testn(e-1)?this.notn(e).iaddn(1).ineg():this.clone()},y.prototype.isNeg=function(){return 0!==this.negative},y.prototype.neg=function(){return this.clone().ineg()},y.prototype.ineg=function(){return this.isZero()||(this.negative^=1),this},y.prototype.iuor=function(e){for(;this.length<e.length;)this.words[this.length++]=0;for(var t=0;t<e.length;t++)this.words[t]=this.words[t]|e.words[t];return this.strip()},y.prototype.ior=function(e){return m(0==(this.negative|e.negative)),this.iuor(e)},y.prototype.or=function(e){return this.length>e.length?this.clone().ior(e):e.clone().ior(this)},y.prototype.uor=function(e){return this.length>e.length?this.clone().iuor(e):e.clone().iuor(this)},y.prototype.iuand=function(e){var t;t=this.length>e.length?e:this;for(var r=0;r<t.length;r++)this.words[r]=this.words[r]&e.words[r];return this.length=t.length,this.strip()},y.prototype.iand=function(e){return m(0==(this.negative|e.negative)),this.iuand(e)},y.prototype.and=function(e){return this.length>e.length?this.clone().iand(e):e.clone().iand(this)},y.prototype.uand=function(e){return this.length>e.length?this.clone().iuand(e):e.clone().iuand(this)},y.prototype.iuxor=function(e){var t,r;this.length>e.length?(t=this,r=e):(t=e,r=this);for(var n=0;n<r.length;n++)this.words[n]=t.words[n]^r.words[n];if(this!==t)for(;n<t.length;n++)this.words[n]=t.words[n];return this.length=t.length,this.strip()},y.prototype.ixor=function(e){return m(0==(this.negative|e.negative)),this.iuxor(e)},y.prototype.xor=function(e){return this.length>e.length?this.clone().ixor(e):e.clone().ixor(this)},y.prototype.uxor=function(e){return this.length>e.length?this.clone().iuxor(e):e.clone().iuxor(this)},y.prototype.inotn=function(e){m("number"==typeof e&&0<=e);var t=0|Math.ceil(e/26),r=e%26;this._expand(t),0<r&&t--;for(var n=0;n<t;n++)this.words[n]=67108863&~this.words[n];return 0<r&&(this.words[n]=~this.words[n]&67108863>>26-r),this.strip()},y.prototype.notn=function(e){return this.clone().inotn(e)},y.prototype.setn=function(e,t){m("number"==typeof e&&0<=e);var r=e/26|0,n=e%26;return this._expand(r+1),this.words[r]=t?this.words[r]|1<<n:this.words[r]&~(1<<n),this.strip()},y.prototype.iadd=function(e){var t,r,n;if(0!==this.negative&&0===e.negative)return this.negative=0,t=this.isub(e),this.negative^=1,this._normSign();if(0===this.negative&&0!==e.negative)return e.negative=0,t=this.isub(e),e.negative=1,t._normSign();this.length>e.length?(r=this,n=e):(r=e,n=this);for(var i=0,o=0;o<n.length;o++)t=(0|r.words[o])+(0|n.words[o])+i,this.words[o]=67108863&t,i=t>>>26;for(;0!==i&&o<r.length;o++)t=(0|r.words[o])+i,this.words[o]=67108863&t,i=t>>>26;if(this.length=r.length,0!==i)this.words[this.length]=i,this.length++;else if(r!==this)for(;o<r.length;o++)this.words[o]=r.words[o];return this},y.prototype.add=function(e){var t;return 0!==e.negative&&0===this.negative?(e.negative=0,t=this.sub(e),e.negative^=1,t):0===e.negative&&0!==this.negative?(this.negative=0,t=e.sub(this),this.negative=1,t):this.length>e.length?this.clone().iadd(e):e.clone().iadd(this)},y.prototype.isub=function(e){if(0!==e.negative){e.negative=0;var t=this.iadd(e);return e.negative=1,t._normSign()}if(0!==this.negative)return this.negative=0,this.iadd(e),this.negative=1,this._normSign();var r,n,i=this.cmp(e);if(0===i)return this.negative=0,this.length=1,this.words[0]=0,this;0<i?(r=this,n=e):(r=e,n=this);for(var o=0,s=0;s<n.length;s++)o=(t=(0|r.words[s])-(0|n.words[s])+o)>>26,this.words[s]=67108863&t;for(;0!==o&&s<r.length;s++)o=(t=(0|r.words[s])+o)>>26,this.words[s]=67108863&t;if(0===o&&s<r.length&&r!==this)for(;s<r.length;s++)this.words[s]=r.words[s];return this.length=Math.max(this.length,s),r!==this&&(this.negative=1),this.strip()},y.prototype.sub=function(e){return this.clone().isub(e)};var o=function(e,t,r){var n,i,o,s=e.words,a=t.words,u=r.words,l=0,f=0|s[0],h=8191&f,c=f>>>13,d=0|s[1],p=8191&d,v=d>>>13,m=0|s[2],y=8191&m,g=m>>>13,b=0|s[3],w=8191&b,_=b>>>13,M=0|s[4],A=8191&M,E=M>>>13,S=0|s[5],k=8191&S,N=S>>>13,P=0|s[6],x=8191&P,I=P>>>13,T=0|s[7],R=8191&T,O=T>>>13,C=0|s[8],B=8191&C,D=C>>>13,L=0|s[9],U=8191&L,F=L>>>13,j=0|a[0],G=8191&j,z=j>>>13,H=0|a[1],V=8191&H,q=H>>>13,K=0|a[2],W=8191&K,Z=K>>>13,J=0|a[3],X=8191&J,$=J>>>13,Q=0|a[4],Y=8191&Q,ee=Q>>>13,te=0|a[5],re=8191&te,ne=te>>>13,ie=0|a[6],oe=8191&ie,se=ie>>>13,ae=0|a[7],ue=8191&ae,le=ae>>>13,fe=0|a[8],he=8191&fe,ce=fe>>>13,de=0|a[9],pe=8191&de,ve=de>>>13;r.negative=e.negative^t.negative,r.length=19;var me=(l+(n=Math.imul(h,G))|0)+((8191&(i=(i=Math.imul(h,z))+Math.imul(c,G)|0))<<13)|0;l=((o=Math.imul(c,z))+(i>>>13)|0)+(me>>>26)|0,me&=67108863,n=Math.imul(p,G),i=(i=Math.imul(p,z))+Math.imul(v,G)|0,o=Math.imul(v,z);var ye=(l+(n=n+Math.imul(h,V)|0)|0)+((8191&(i=(i=i+Math.imul(h,q)|0)+Math.imul(c,V)|0))<<13)|0;l=((o=o+Math.imul(c,q)|0)+(i>>>13)|0)+(ye>>>26)|0,ye&=67108863,n=Math.imul(y,G),i=(i=Math.imul(y,z))+Math.imul(g,G)|0,o=Math.imul(g,z),n=n+Math.imul(p,V)|0,i=(i=i+Math.imul(p,q)|0)+Math.imul(v,V)|0,o=o+Math.imul(v,q)|0;var ge=(l+(n=n+Math.imul(h,W)|0)|0)+((8191&(i=(i=i+Math.imul(h,Z)|0)+Math.imul(c,W)|0))<<13)|0;l=((o=o+Math.imul(c,Z)|0)+(i>>>13)|0)+(ge>>>26)|0,ge&=67108863,n=Math.imul(w,G),i=(i=Math.imul(w,z))+Math.imul(_,G)|0,o=Math.imul(_,z),n=n+Math.imul(y,V)|0,i=(i=i+Math.imul(y,q)|0)+Math.imul(g,V)|0,o=o+Math.imul(g,q)|0,n=n+Math.imul(p,W)|0,i=(i=i+Math.imul(p,Z)|0)+Math.imul(v,W)|0,o=o+Math.imul(v,Z)|0;var be=(l+(n=n+Math.imul(h,X)|0)|0)+((8191&(i=(i=i+Math.imul(h,$)|0)+Math.imul(c,X)|0))<<13)|0;l=((o=o+Math.imul(c,$)|0)+(i>>>13)|0)+(be>>>26)|0,be&=67108863,n=Math.imul(A,G),i=(i=Math.imul(A,z))+Math.imul(E,G)|0,o=Math.imul(E,z),n=n+Math.imul(w,V)|0,i=(i=i+Math.imul(w,q)|0)+Math.imul(_,V)|0,o=o+Math.imul(_,q)|0,n=n+Math.imul(y,W)|0,i=(i=i+Math.imul(y,Z)|0)+Math.imul(g,W)|0,o=o+Math.imul(g,Z)|0,n=n+Math.imul(p,X)|0,i=(i=i+Math.imul(p,$)|0)+Math.imul(v,X)|0,o=o+Math.imul(v,$)|0;var we=(l+(n=n+Math.imul(h,Y)|0)|0)+((8191&(i=(i=i+Math.imul(h,ee)|0)+Math.imul(c,Y)|0))<<13)|0;l=((o=o+Math.imul(c,ee)|0)+(i>>>13)|0)+(we>>>26)|0,we&=67108863,n=Math.imul(k,G),i=(i=Math.imul(k,z))+Math.imul(N,G)|0,o=Math.imul(N,z),n=n+Math.imul(A,V)|0,i=(i=i+Math.imul(A,q)|0)+Math.imul(E,V)|0,o=o+Math.imul(E,q)|0,n=n+Math.imul(w,W)|0,i=(i=i+Math.imul(w,Z)|0)+Math.imul(_,W)|0,o=o+Math.imul(_,Z)|0,n=n+Math.imul(y,X)|0,i=(i=i+Math.imul(y,$)|0)+Math.imul(g,X)|0,o=o+Math.imul(g,$)|0,n=n+Math.imul(p,Y)|0,i=(i=i+Math.imul(p,ee)|0)+Math.imul(v,Y)|0,o=o+Math.imul(v,ee)|0;var _e=(l+(n=n+Math.imul(h,re)|0)|0)+((8191&(i=(i=i+Math.imul(h,ne)|0)+Math.imul(c,re)|0))<<13)|0;l=((o=o+Math.imul(c,ne)|0)+(i>>>13)|0)+(_e>>>26)|0,_e&=67108863,n=Math.imul(x,G),i=(i=Math.imul(x,z))+Math.imul(I,G)|0,o=Math.imul(I,z),n=n+Math.imul(k,V)|0,i=(i=i+Math.imul(k,q)|0)+Math.imul(N,V)|0,o=o+Math.imul(N,q)|0,n=n+Math.imul(A,W)|0,i=(i=i+Math.imul(A,Z)|0)+Math.imul(E,W)|0,o=o+Math.imul(E,Z)|0,n=n+Math.imul(w,X)|0,i=(i=i+Math.imul(w,$)|0)+Math.imul(_,X)|0,o=o+Math.imul(_,$)|0,n=n+Math.imul(y,Y)|0,i=(i=i+Math.imul(y,ee)|0)+Math.imul(g,Y)|0,o=o+Math.imul(g,ee)|0,n=n+Math.imul(p,re)|0,i=(i=i+Math.imul(p,ne)|0)+Math.imul(v,re)|0,o=o+Math.imul(v,ne)|0;var Me=(l+(n=n+Math.imul(h,oe)|0)|0)+((8191&(i=(i=i+Math.imul(h,se)|0)+Math.imul(c,oe)|0))<<13)|0;l=((o=o+Math.imul(c,se)|0)+(i>>>13)|0)+(Me>>>26)|0,Me&=67108863,n=Math.imul(R,G),i=(i=Math.imul(R,z))+Math.imul(O,G)|0,o=Math.imul(O,z),n=n+Math.imul(x,V)|0,i=(i=i+Math.imul(x,q)|0)+Math.imul(I,V)|0,o=o+Math.imul(I,q)|0,n=n+Math.imul(k,W)|0,i=(i=i+Math.imul(k,Z)|0)+Math.imul(N,W)|0,o=o+Math.imul(N,Z)|0,n=n+Math.imul(A,X)|0,i=(i=i+Math.imul(A,$)|0)+Math.imul(E,X)|0,o=o+Math.imul(E,$)|0,n=n+Math.imul(w,Y)|0,i=(i=i+Math.imul(w,ee)|0)+Math.imul(_,Y)|0,o=o+Math.imul(_,ee)|0,n=n+Math.imul(y,re)|0,i=(i=i+Math.imul(y,ne)|0)+Math.imul(g,re)|0,o=o+Math.imul(g,ne)|0,n=n+Math.imul(p,oe)|0,i=(i=i+Math.imul(p,se)|0)+Math.imul(v,oe)|0,o=o+Math.imul(v,se)|0;var Ae=(l+(n=n+Math.imul(h,ue)|0)|0)+((8191&(i=(i=i+Math.imul(h,le)|0)+Math.imul(c,ue)|0))<<13)|0;l=((o=o+Math.imul(c,le)|0)+(i>>>13)|0)+(Ae>>>26)|0,Ae&=67108863,n=Math.imul(B,G),i=(i=Math.imul(B,z))+Math.imul(D,G)|0,o=Math.imul(D,z),n=n+Math.imul(R,V)|0,i=(i=i+Math.imul(R,q)|0)+Math.imul(O,V)|0,o=o+Math.imul(O,q)|0,n=n+Math.imul(x,W)|0,i=(i=i+Math.imul(x,Z)|0)+Math.imul(I,W)|0,o=o+Math.imul(I,Z)|0,n=n+Math.imul(k,X)|0,i=(i=i+Math.imul(k,$)|0)+Math.imul(N,X)|0,o=o+Math.imul(N,$)|0,n=n+Math.imul(A,Y)|0,i=(i=i+Math.imul(A,ee)|0)+Math.imul(E,Y)|0,o=o+Math.imul(E,ee)|0,n=n+Math.imul(w,re)|0,i=(i=i+Math.imul(w,ne)|0)+Math.imul(_,re)|0,o=o+Math.imul(_,ne)|0,n=n+Math.imul(y,oe)|0,i=(i=i+Math.imul(y,se)|0)+Math.imul(g,oe)|0,o=o+Math.imul(g,se)|0,n=n+Math.imul(p,ue)|0,i=(i=i+Math.imul(p,le)|0)+Math.imul(v,ue)|0,o=o+Math.imul(v,le)|0;var Ee=(l+(n=n+Math.imul(h,he)|0)|0)+((8191&(i=(i=i+Math.imul(h,ce)|0)+Math.imul(c,he)|0))<<13)|0;l=((o=o+Math.imul(c,ce)|0)+(i>>>13)|0)+(Ee>>>26)|0,Ee&=67108863,n=Math.imul(U,G),i=(i=Math.imul(U,z))+Math.imul(F,G)|0,o=Math.imul(F,z),n=n+Math.imul(B,V)|0,i=(i=i+Math.imul(B,q)|0)+Math.imul(D,V)|0,o=o+Math.imul(D,q)|0,n=n+Math.imul(R,W)|0,i=(i=i+Math.imul(R,Z)|0)+Math.imul(O,W)|0,o=o+Math.imul(O,Z)|0,n=n+Math.imul(x,X)|0,i=(i=i+Math.imul(x,$)|0)+Math.imul(I,X)|0,o=o+Math.imul(I,$)|0,n=n+Math.imul(k,Y)|0,i=(i=i+Math.imul(k,ee)|0)+Math.imul(N,Y)|0,o=o+Math.imul(N,ee)|0,n=n+Math.imul(A,re)|0,i=(i=i+Math.imul(A,ne)|0)+Math.imul(E,re)|0,o=o+Math.imul(E,ne)|0,n=n+Math.imul(w,oe)|0,i=(i=i+Math.imul(w,se)|0)+Math.imul(_,oe)|0,o=o+Math.imul(_,se)|0,n=n+Math.imul(y,ue)|0,i=(i=i+Math.imul(y,le)|0)+Math.imul(g,ue)|0,o=o+Math.imul(g,le)|0,n=n+Math.imul(p,he)|0,i=(i=i+Math.imul(p,ce)|0)+Math.imul(v,he)|0,o=o+Math.imul(v,ce)|0;var Se=(l+(n=n+Math.imul(h,pe)|0)|0)+((8191&(i=(i=i+Math.imul(h,ve)|0)+Math.imul(c,pe)|0))<<13)|0;l=((o=o+Math.imul(c,ve)|0)+(i>>>13)|0)+(Se>>>26)|0,Se&=67108863,n=Math.imul(U,V),i=(i=Math.imul(U,q))+Math.imul(F,V)|0,o=Math.imul(F,q),n=n+Math.imul(B,W)|0,i=(i=i+Math.imul(B,Z)|0)+Math.imul(D,W)|0,o=o+Math.imul(D,Z)|0,n=n+Math.imul(R,X)|0,i=(i=i+Math.imul(R,$)|0)+Math.imul(O,X)|0,o=o+Math.imul(O,$)|0,n=n+Math.imul(x,Y)|0,i=(i=i+Math.imul(x,ee)|0)+Math.imul(I,Y)|0,o=o+Math.imul(I,ee)|0,n=n+Math.imul(k,re)|0,i=(i=i+Math.imul(k,ne)|0)+Math.imul(N,re)|0,o=o+Math.imul(N,ne)|0,n=n+Math.imul(A,oe)|0,i=(i=i+Math.imul(A,se)|0)+Math.imul(E,oe)|0,o=o+Math.imul(E,se)|0,n=n+Math.imul(w,ue)|0,i=(i=i+Math.imul(w,le)|0)+Math.imul(_,ue)|0,o=o+Math.imul(_,le)|0,n=n+Math.imul(y,he)|0,i=(i=i+Math.imul(y,ce)|0)+Math.imul(g,he)|0,o=o+Math.imul(g,ce)|0;var ke=(l+(n=n+Math.imul(p,pe)|0)|0)+((8191&(i=(i=i+Math.imul(p,ve)|0)+Math.imul(v,pe)|0))<<13)|0;l=((o=o+Math.imul(v,ve)|0)+(i>>>13)|0)+(ke>>>26)|0,ke&=67108863,n=Math.imul(U,W),i=(i=Math.imul(U,Z))+Math.imul(F,W)|0,o=Math.imul(F,Z),n=n+Math.imul(B,X)|0,i=(i=i+Math.imul(B,$)|0)+Math.imul(D,X)|0,o=o+Math.imul(D,$)|0,n=n+Math.imul(R,Y)|0,i=(i=i+Math.imul(R,ee)|0)+Math.imul(O,Y)|0,o=o+Math.imul(O,ee)|0,n=n+Math.imul(x,re)|0,i=(i=i+Math.imul(x,ne)|0)+Math.imul(I,re)|0,o=o+Math.imul(I,ne)|0,n=n+Math.imul(k,oe)|0,i=(i=i+Math.imul(k,se)|0)+Math.imul(N,oe)|0,o=o+Math.imul(N,se)|0,n=n+Math.imul(A,ue)|0,i=(i=i+Math.imul(A,le)|0)+Math.imul(E,ue)|0,o=o+Math.imul(E,le)|0,n=n+Math.imul(w,he)|0,i=(i=i+Math.imul(w,ce)|0)+Math.imul(_,he)|0,o=o+Math.imul(_,ce)|0;var Ne=(l+(n=n+Math.imul(y,pe)|0)|0)+((8191&(i=(i=i+Math.imul(y,ve)|0)+Math.imul(g,pe)|0))<<13)|0;l=((o=o+Math.imul(g,ve)|0)+(i>>>13)|0)+(Ne>>>26)|0,Ne&=67108863,n=Math.imul(U,X),i=(i=Math.imul(U,$))+Math.imul(F,X)|0,o=Math.imul(F,$),n=n+Math.imul(B,Y)|0,i=(i=i+Math.imul(B,ee)|0)+Math.imul(D,Y)|0,o=o+Math.imul(D,ee)|0,n=n+Math.imul(R,re)|0,i=(i=i+Math.imul(R,ne)|0)+Math.imul(O,re)|0,o=o+Math.imul(O,ne)|0,n=n+Math.imul(x,oe)|0,i=(i=i+Math.imul(x,se)|0)+Math.imul(I,oe)|0,o=o+Math.imul(I,se)|0,n=n+Math.imul(k,ue)|0,i=(i=i+Math.imul(k,le)|0)+Math.imul(N,ue)|0,o=o+Math.imul(N,le)|0,n=n+Math.imul(A,he)|0,i=(i=i+Math.imul(A,ce)|0)+Math.imul(E,he)|0,o=o+Math.imul(E,ce)|0;var Pe=(l+(n=n+Math.imul(w,pe)|0)|0)+((8191&(i=(i=i+Math.imul(w,ve)|0)+Math.imul(_,pe)|0))<<13)|0;l=((o=o+Math.imul(_,ve)|0)+(i>>>13)|0)+(Pe>>>26)|0,Pe&=67108863,n=Math.imul(U,Y),i=(i=Math.imul(U,ee))+Math.imul(F,Y)|0,o=Math.imul(F,ee),n=n+Math.imul(B,re)|0,i=(i=i+Math.imul(B,ne)|0)+Math.imul(D,re)|0,o=o+Math.imul(D,ne)|0,n=n+Math.imul(R,oe)|0,i=(i=i+Math.imul(R,se)|0)+Math.imul(O,oe)|0,o=o+Math.imul(O,se)|0,n=n+Math.imul(x,ue)|0,i=(i=i+Math.imul(x,le)|0)+Math.imul(I,ue)|0,o=o+Math.imul(I,le)|0,n=n+Math.imul(k,he)|0,i=(i=i+Math.imul(k,ce)|0)+Math.imul(N,he)|0,o=o+Math.imul(N,ce)|0;var xe=(l+(n=n+Math.imul(A,pe)|0)|0)+((8191&(i=(i=i+Math.imul(A,ve)|0)+Math.imul(E,pe)|0))<<13)|0;l=((o=o+Math.imul(E,ve)|0)+(i>>>13)|0)+(xe>>>26)|0,xe&=67108863,n=Math.imul(U,re),i=(i=Math.imul(U,ne))+Math.imul(F,re)|0,o=Math.imul(F,ne),n=n+Math.imul(B,oe)|0,i=(i=i+Math.imul(B,se)|0)+Math.imul(D,oe)|0,o=o+Math.imul(D,se)|0,n=n+Math.imul(R,ue)|0,i=(i=i+Math.imul(R,le)|0)+Math.imul(O,ue)|0,o=o+Math.imul(O,le)|0,n=n+Math.imul(x,he)|0,i=(i=i+Math.imul(x,ce)|0)+Math.imul(I,he)|0,o=o+Math.imul(I,ce)|0;var Ie=(l+(n=n+Math.imul(k,pe)|0)|0)+((8191&(i=(i=i+Math.imul(k,ve)|0)+Math.imul(N,pe)|0))<<13)|0;l=((o=o+Math.imul(N,ve)|0)+(i>>>13)|0)+(Ie>>>26)|0,Ie&=67108863,n=Math.imul(U,oe),i=(i=Math.imul(U,se))+Math.imul(F,oe)|0,o=Math.imul(F,se),n=n+Math.imul(B,ue)|0,i=(i=i+Math.imul(B,le)|0)+Math.imul(D,ue)|0,o=o+Math.imul(D,le)|0,n=n+Math.imul(R,he)|0,i=(i=i+Math.imul(R,ce)|0)+Math.imul(O,he)|0,o=o+Math.imul(O,ce)|0;var Te=(l+(n=n+Math.imul(x,pe)|0)|0)+((8191&(i=(i=i+Math.imul(x,ve)|0)+Math.imul(I,pe)|0))<<13)|0;l=((o=o+Math.imul(I,ve)|0)+(i>>>13)|0)+(Te>>>26)|0,Te&=67108863,n=Math.imul(U,ue),i=(i=Math.imul(U,le))+Math.imul(F,ue)|0,o=Math.imul(F,le),n=n+Math.imul(B,he)|0,i=(i=i+Math.imul(B,ce)|0)+Math.imul(D,he)|0,o=o+Math.imul(D,ce)|0;var Re=(l+(n=n+Math.imul(R,pe)|0)|0)+((8191&(i=(i=i+Math.imul(R,ve)|0)+Math.imul(O,pe)|0))<<13)|0;l=((o=o+Math.imul(O,ve)|0)+(i>>>13)|0)+(Re>>>26)|0,Re&=67108863,n=Math.imul(U,he),i=(i=Math.imul(U,ce))+Math.imul(F,he)|0,o=Math.imul(F,ce);var Oe=(l+(n=n+Math.imul(B,pe)|0)|0)+((8191&(i=(i=i+Math.imul(B,ve)|0)+Math.imul(D,pe)|0))<<13)|0;l=((o=o+Math.imul(D,ve)|0)+(i>>>13)|0)+(Oe>>>26)|0,Oe&=67108863;var Ce=(l+(n=Math.imul(U,pe))|0)+((8191&(i=(i=Math.imul(U,ve))+Math.imul(F,pe)|0))<<13)|0;return l=((o=Math.imul(F,ve))+(i>>>13)|0)+(Ce>>>26)|0,Ce&=67108863,u[0]=me,u[1]=ye,u[2]=ge,u[3]=be,u[4]=we,u[5]=_e,u[6]=Me,u[7]=Ae,u[8]=Ee,u[9]=Se,u[10]=ke,u[11]=Ne,u[12]=Pe,u[13]=xe,u[14]=Ie,u[15]=Te,u[16]=Re,u[17]=Oe,u[18]=Ce,0!==l&&(u[19]=l,r.length++),r};function a(e,t,r){return(new u).mulp(e,t,r)}function u(e,t){this.x=e,this.y=t}Math.imul||(o=i),y.prototype.mulTo=function(e,t){var r=this.length+e.length;return 10===this.length&&10===e.length?o(this,e,t):r<63?i(this,e,t):r<1024?function(e,t,r){r.negative=t.negative^e.negative,r.length=e.length+t.length;for(var n=0,i=0,o=0;o<r.length-1;o++){var s=i;i=0;for(var a=67108863&n,u=Math.min(o,t.length-1),l=Math.max(0,o-e.length+1);l<=u;l++){var f=o-l,h=(0|e.words[f])*(0|t.words[l]),c=67108863&h;a=67108863&(c=c+a|0),i+=(s=(s=s+(h/67108864|0)|0)+(c>>>26)|0)>>>26,s&=67108863}r.words[o]=a,n=s,s=i}return 0!==n?r.words[o]=n:r.length--,r.strip()}(this,e,t):a(this,e,t)},u.prototype.makeRBT=function(e){for(var t=new Array(e),r=y.prototype._countBits(e)-1,n=0;n<e;n++)t[n]=this.revBin(n,r,e);return t},u.prototype.revBin=function(e,t,r){if(0===e||e===r-1)return e;for(var n=0,i=0;i<t;i++)n|=(1&e)<<t-i-1,e>>=1;return n},u.prototype.permute=function(e,t,r,n,i,o){for(var s=0;s<o;s++)n[s]=t[e[s]],i[s]=r[e[s]]},u.prototype.transform=function(e,t,r,n,i,o){this.permute(o,e,t,r,n,i);for(var s=1;s<i;s<<=1)for(var a=s<<1,u=Math.cos(2*Math.PI/a),l=Math.sin(2*Math.PI/a),f=0;f<i;f+=a)for(var h=u,c=l,d=0;d<s;d++){var p=r[f+d],v=n[f+d],m=r[f+d+s],y=n[f+d+s],g=h*m-c*y;y=h*y+c*m,m=g,r[f+d]=p+m,n[f+d]=v+y,r[f+d+s]=p-m,n[f+d+s]=v-y,d!==a&&(g=u*h-l*c,c=u*c+l*h,h=g)}},u.prototype.guessLen13b=function(e,t){var r=1|Math.max(t,e),n=1&r,i=0;for(r=r/2|0;r;r>>>=1)i++;return 1<<i+1+n},u.prototype.conjugate=function(e,t,r){if(!(r<=1))for(var n=0;n<r/2;n++){var i=e[n];e[n]=e[r-n-1],e[r-n-1]=i,i=t[n],t[n]=-t[r-n-1],t[r-n-1]=-i}},u.prototype.normalize13b=function(e,t){for(var r=0,n=0;n<t/2;n++){var i=8192*Math.round(e[2*n+1]/t)+Math.round(e[2*n]/t)+r;e[n]=67108863&i,r=i<67108864?0:i/67108864|0}return e},u.prototype.convert13b=function(e,t,r,n){for(var i=0,o=0;o<t;o++)i+=0|e[o],r[2*o]=8191&i,i>>>=13,r[2*o+1]=8191&i,i>>>=13;for(o=2*t;o<n;++o)r[o]=0;m(0===i),m(0==(-8192&i))},u.prototype.stub=function(e){for(var t=new Array(e),r=0;r<e;r++)t[r]=0;return t},u.prototype.mulp=function(e,t,r){var n=2*this.guessLen13b(e.length,t.length),i=this.makeRBT(n),o=this.stub(n),s=new Array(n),a=new Array(n),u=new Array(n),l=new Array(n),f=new Array(n),h=new Array(n),c=r.words;c.length=n,this.convert13b(e.words,e.length,s,n),this.convert13b(t.words,t.length,l,n),this.transform(s,o,a,u,n,i),this.transform(l,o,f,h,n,i);for(var d=0;d<n;d++){var p=a[d]*f[d]-u[d]*h[d];u[d]=a[d]*h[d]+u[d]*f[d],a[d]=p}return this.conjugate(a,u,n),this.transform(a,u,c,o,n,i),this.conjugate(c,o,n),this.normalize13b(c,n),r.negative=e.negative^t.negative,r.length=e.length+t.length,r.strip()},y.prototype.mul=function(e){var t=new y(null);return t.words=new Array(this.length+e.length),this.mulTo(e,t)},y.prototype.mulf=function(e){var t=new y(null);return t.words=new Array(this.length+e.length),a(this,e,t)},y.prototype.imul=function(e){return this.clone().mulTo(e,this)},y.prototype.imuln=function(e){m("number"==typeof e),m(e<67108864);for(var t=0,r=0;r<this.length;r++){var n=(0|this.words[r])*e,i=(67108863&n)+(67108863&t);t>>=26,t+=n/67108864|0,t+=i>>>26,this.words[r]=67108863&i}return 0!==t&&(this.words[r]=t,this.length++),this},y.prototype.muln=function(e){return this.clone().imuln(e)},y.prototype.sqr=function(){return this.mul(this)},y.prototype.isqr=function(){return this.imul(this.clone())},y.prototype.pow=function(e){var t=function(e){for(var t=new Array(e.bitLength()),r=0;r<t.length;r++){var n=r/26|0,i=r%26;t[r]=(e.words[n]&1<<i)>>>i}return t}(e);if(0===t.length)return new y(1);for(var r=this,n=0;n<t.length&&0===t[n];n++,r=r.sqr());if(++n<t.length)for(var i=r.sqr();n<t.length;n++,i=i.sqr())0!==t[n]&&(r=r.mul(i));return r},y.prototype.iushln=function(e){m("number"==typeof e&&0<=e);var t,r=e%26,n=(e-r)/26,i=67108863>>>26-r<<26-r;if(0!==r){var o=0;for(t=0;t<this.length;t++){var s=this.words[t]&i,a=(0|this.words[t])-s<<r;this.words[t]=a|o,o=s>>>26-r}o&&(this.words[t]=o,this.length++)}if(0!==n){for(t=this.length-1;0<=t;t--)this.words[t+n]=this.words[t];for(t=0;t<n;t++)this.words[t]=0;this.length+=n}return this.strip()},y.prototype.ishln=function(e){return m(0===this.negative),this.iushln(e)},y.prototype.iushrn=function(e,t,r){var n;m("number"==typeof e&&0<=e),n=t?(t-t%26)/26:0;var i=e%26,o=Math.min((e-i)/26,this.length),s=67108863^67108863>>>i<<i,a=r;if(n-=o,n=Math.max(0,n),a){for(var u=0;u<o;u++)a.words[u]=this.words[u];a.length=o}if(0===o);else if(this.length>o)for(this.length-=o,u=0;u<this.length;u++)this.words[u]=this.words[u+o];else this.words[0]=0,this.length=1;var l=0;for(u=this.length-1;0<=u&&(0!==l||n<=u);u--){var f=0|this.words[u];this.words[u]=l<<26-i|f>>>i,l=f&s}return a&&0!==l&&(a.words[a.length++]=l),0===this.length&&(this.words[0]=0,this.length=1),this.strip()},y.prototype.ishrn=function(e,t,r){return m(0===this.negative),this.iushrn(e,t,r)},y.prototype.shln=function(e){return this.clone().ishln(e)},y.prototype.ushln=function(e){return this.clone().iushln(e)},y.prototype.shrn=function(e){return this.clone().ishrn(e)},y.prototype.ushrn=function(e){return this.clone().iushrn(e)},y.prototype.testn=function(e){m("number"==typeof e&&0<=e);var t=e%26,r=(e-t)/26,n=1<<t;return!(this.length<=r)&&!!(this.words[r]&n)},y.prototype.imaskn=function(e){m("number"==typeof e&&0<=e);var t=e%26,r=(e-t)/26;if(m(0===this.negative,"imaskn works only with positive numbers"),this.length<=r)return this;if(0!==t&&r++,this.length=Math.min(r,this.length),0!==t){var n=67108863^67108863>>>t<<t;this.words[this.length-1]&=n}return this.strip()},y.prototype.maskn=function(e){return this.clone().imaskn(e)},y.prototype.iaddn=function(e){return m("number"==typeof e),m(e<67108864),e<0?this.isubn(-e):0!==this.negative?(1===this.length&&(0|this.words[0])<e?(this.words[0]=e-(0|this.words[0]),this.negative=0):(this.negative=0,this.isubn(e),this.negative=1),this):this._iaddn(e)},y.prototype._iaddn=function(e){this.words[0]+=e;for(var t=0;t<this.length&&67108864<=this.words[t];t++)this.words[t]-=67108864,t===this.length-1?this.words[t+1]=1:this.words[t+1]++;return this.length=Math.max(this.length,t+1),this},y.prototype.isubn=function(e){if(m("number"==typeof e),m(e<67108864),e<0)return this.iaddn(-e);if(0!==this.negative)return this.negative=0,this.iaddn(e),this.negative=1,this;if(this.words[0]-=e,1===this.length&&this.words[0]<0)this.words[0]=-this.words[0],this.negative=1;else for(var t=0;t<this.length&&this.words[t]<0;t++)this.words[t]+=67108864,this.words[t+1]-=1;return this.strip()},y.prototype.addn=function(e){return this.clone().iaddn(e)},y.prototype.subn=function(e){return this.clone().isubn(e)},y.prototype.iabs=function(){return this.negative=0,this},y.prototype.abs=function(){return this.clone().iabs()},y.prototype._ishlnsubmul=function(e,t,r){var n,i,o=e.length+r;this._expand(o);var s=0;for(n=0;n<e.length;n++){i=(0|this.words[n+r])+s;var a=(0|e.words[n])*t;s=((i-=67108863&a)>>26)-(a/67108864|0),this.words[n+r]=67108863&i}for(;n<this.length-r;n++)s=(i=(0|this.words[n+r])+s)>>26,this.words[n+r]=67108863&i;if(0===s)return this.strip();for(m(-1===s),n=s=0;n<this.length;n++)s=(i=-(0|this.words[n])+s)>>26,this.words[n]=67108863&i;return this.negative=1,this.strip()},y.prototype._wordDiv=function(e,t){var r=(this.length,e.length),n=this.clone(),i=e,o=0|i.words[i.length-1];0!==(r=26-this._countBits(o))&&(i=i.ushln(r),n.iushln(r),o=0|i.words[i.length-1]);var s,a=n.length-i.length;if("mod"!==t){(s=new y(null)).length=a+1,s.words=new Array(s.length);for(var u=0;u<s.length;u++)s.words[u]=0}var l=n.clone()._ishlnsubmul(i,1,a);0===l.negative&&(n=l,s&&(s.words[a]=1));for(var f=a-1;0<=f;f--){var h=67108864*(0|n.words[i.length+f])+(0|n.words[i.length+f-1]);for(h=Math.min(h/o|0,67108863),n._ishlnsubmul(i,h,f);0!==n.negative;)h--,n.negative=0,n._ishlnsubmul(i,1,f),n.isZero()||(n.negative^=1);s&&(s.words[f]=h)}return s&&s.strip(),n.strip(),"div"!==t&&0!==r&&n.iushrn(r),{div:s||null,mod:n}},y.prototype.divmod=function(e,t,r){return m(!e.isZero()),this.isZero()?{div:new y(0),mod:new y(0)}:0!==this.negative&&0===e.negative?(o=this.neg().divmod(e,t),"mod"!==t&&(n=o.div.neg()),"div"!==t&&(i=o.mod.neg(),r&&0!==i.negative&&i.iadd(e)),{div:n,mod:i}):0===this.negative&&0!==e.negative?(o=this.divmod(e.neg(),t),"mod"!==t&&(n=o.div.neg()),{div:n,mod:o.mod}):0!=(this.negative&e.negative)?(o=this.neg().divmod(e.neg(),t),"div"!==t&&(i=o.mod.neg(),r&&0!==i.negative&&i.isub(e)),{div:o.div,mod:i}):e.length>this.length||this.cmp(e)<0?{div:new y(0),mod:this}:1===e.length?"div"===t?{div:this.divn(e.words[0]),mod:null}:"mod"===t?{div:null,mod:new y(this.modn(e.words[0]))}:{div:this.divn(e.words[0]),mod:new y(this.modn(e.words[0]))}:this._wordDiv(e,t);var n,i,o},y.prototype.div=function(e){return this.divmod(e,"div",!1).div},y.prototype.mod=function(e){return this.divmod(e,"mod",!1).mod},y.prototype.umod=function(e){return this.divmod(e,"mod",!0).mod},y.prototype.divRound=function(e){var t=this.divmod(e);if(t.mod.isZero())return t.div;var r=0!==t.div.negative?t.mod.isub(e):t.mod,n=e.ushrn(1),i=e.andln(1),o=r.cmp(n);return o<0||1===i&&0===o?t.div:0!==t.div.negative?t.div.isubn(1):t.div.iaddn(1)},y.prototype.modn=function(e){m(e<=67108863);for(var t=(1<<26)%e,r=0,n=this.length-1;0<=n;n--)r=(t*r+(0|this.words[n]))%e;return r},y.prototype.idivn=function(e){m(e<=67108863);for(var t=0,r=this.length-1;0<=r;r--){var n=(0|this.words[r])+67108864*t;this.words[r]=n/e|0,t=n%e}return this.strip()},y.prototype.divn=function(e){return this.clone().idivn(e)},y.prototype.egcd=function(e){m(0===e.negative),m(!e.isZero());var t=this,r=e.clone();t=0!==t.negative?t.umod(e):t.clone();for(var n=new y(1),i=new y(0),o=new y(0),s=new y(1),a=0;t.isEven()&&r.isEven();)t.iushrn(1),r.iushrn(1),++a;for(var u=r.clone(),l=t.clone();!t.isZero();){for(var f=0,h=1;0==(t.words[0]&h)&&f<26;++f,h<<=1);if(0<f)for(t.iushrn(f);0<f--;)(n.isOdd()||i.isOdd())&&(n.iadd(u),i.isub(l)),n.iushrn(1),i.iushrn(1);for(var c=0,d=1;0==(r.words[0]&d)&&c<26;++c,d<<=1);if(0<c)for(r.iushrn(c);0<c--;)(o.isOdd()||s.isOdd())&&(o.iadd(u),s.isub(l)),o.iushrn(1),s.iushrn(1);0<=t.cmp(r)?(t.isub(r),n.isub(o),i.isub(s)):(r.isub(t),o.isub(n),s.isub(i))}return{a:o,b:s,gcd:r.iushln(a)}},y.prototype._invmp=function(e){m(0===e.negative),m(!e.isZero());var t=this,r=e.clone();t=0!==t.negative?t.umod(e):t.clone();for(var n,i=new y(1),o=new y(0),s=r.clone();0<t.cmpn(1)&&0<r.cmpn(1);){for(var a=0,u=1;0==(t.words[0]&u)&&a<26;++a,u<<=1);if(0<a)for(t.iushrn(a);0<a--;)i.isOdd()&&i.iadd(s),i.iushrn(1);for(var l=0,f=1;0==(r.words[0]&f)&&l<26;++l,f<<=1);if(0<l)for(r.iushrn(l);0<l--;)o.isOdd()&&o.iadd(s),o.iushrn(1);0<=t.cmp(r)?(t.isub(r),i.isub(o)):(r.isub(t),o.isub(i))}return(n=0===t.cmpn(1)?i:o).cmpn(0)<0&&n.iadd(e),n},y.prototype.gcd=function(e){if(this.isZero())return e.abs();if(e.isZero())return this.abs();var t=this.clone(),r=e.clone();t.negative=0;for(var n=r.negative=0;t.isEven()&&r.isEven();n++)t.iushrn(1),r.iushrn(1);for(;;){for(;t.isEven();)t.iushrn(1);for(;r.isEven();)r.iushrn(1);var i=t.cmp(r);if(i<0){var o=t;t=r,r=o}else if(0===i||0===r.cmpn(1))break;t.isub(r)}return r.iushln(n)},y.prototype.invm=function(e){return this.egcd(e).a.umod(e)},y.prototype.isEven=function(){return 0==(1&this.words[0])},y.prototype.isOdd=function(){return 1==(1&this.words[0])},y.prototype.andln=function(e){return this.words[0]&e},y.prototype.bincn=function(e){m("number"==typeof e);var t=e%26,r=(e-t)/26,n=1<<t;if(this.length<=r)return this._expand(r+1),this.words[r]|=n,this;for(var i=n,o=r;0!==i&&o<this.length;o++){var s=0|this.words[o];i=(s+=i)>>>26,s&=67108863,this.words[o]=s}return 0!==i&&(this.words[o]=i,this.length++),this},y.prototype.isZero=function(){return 1===this.length&&0===this.words[0]},y.prototype.cmpn=function(e){var t,r=e<0;if(0!==this.negative&&!r)return-1;if(0===this.negative&&r)return 1;if(this.strip(),1<this.length)t=1;else{r&&(e=-e),m(e<=67108863,"Number is too big");var n=0|this.words[0];t=n===e?0:n<e?-1:1}return 0!==this.negative?0|-t:t},y.prototype.cmp=function(e){if(0!==this.negative&&0===e.negative)return-1;if(0===this.negative&&0!==e.negative)return 1;var t=this.ucmp(e);return 0!==this.negative?0|-t:t},y.prototype.ucmp=function(e){if(this.length>e.length)return 1;if(this.length<e.length)return-1;for(var t=0,r=this.length-1;0<=r;r--){var n=0|this.words[r],i=0|e.words[r];if(n!==i){n<i?t=-1:i<n&&(t=1);break}}return t},y.prototype.gtn=function(e){return 1===this.cmpn(e)},y.prototype.gt=function(e){return 1===this.cmp(e)},y.prototype.gten=function(e){return 0<=this.cmpn(e)},y.prototype.gte=function(e){return 0<=this.cmp(e)},y.prototype.ltn=function(e){return-1===this.cmpn(e)},y.prototype.lt=function(e){return-1===this.cmp(e)},y.prototype.lten=function(e){return this.cmpn(e)<=0},y.prototype.lte=function(e){return this.cmp(e)<=0},y.prototype.eqn=function(e){return 0===this.cmpn(e)},y.prototype.eq=function(e){return 0===this.cmp(e)},y.red=function(e){return new _(e)},y.prototype.toRed=function(e){return m(!this.red,"Already a number in reduction context"),m(0===this.negative,"red works only with positives"),e.convertTo(this)._forceRed(e)},y.prototype.fromRed=function(){return m(this.red,"fromRed works only with numbers in reduction context"),this.red.convertFrom(this)},y.prototype._forceRed=function(e){return this.red=e,this},y.prototype.forceRed=function(e){return m(!this.red,"Already a number in reduction context"),this._forceRed(e)},y.prototype.redAdd=function(e){return m(this.red,"redAdd works only with red numbers"),this.red.add(this,e)},y.prototype.redIAdd=function(e){return m(this.red,"redIAdd works only with red numbers"),this.red.iadd(this,e)},y.prototype.redSub=function(e){return m(this.red,"redSub works only with red numbers"),this.red.sub(this,e)},y.prototype.redISub=function(e){return m(this.red,"redISub works only with red numbers"),this.red.isub(this,e)},y.prototype.redShl=function(e){return m(this.red,"redShl works only with red numbers"),this.red.shl(this,e)},y.prototype.redMul=function(e){return m(this.red,"redMul works only with red numbers"),this.red._verify2(this,e),this.red.mul(this,e)},y.prototype.redIMul=function(e){return m(this.red,"redMul works only with red numbers"),this.red._verify2(this,e),this.red.imul(this,e)},y.prototype.redSqr=function(){return m(this.red,"redSqr works only with red numbers"),this.red._verify1(this),this.red.sqr(this)},y.prototype.redISqr=function(){return m(this.red,"redISqr works only with red numbers"),this.red._verify1(this),this.red.isqr(this)},y.prototype.redSqrt=function(){return m(this.red,"redSqrt works only with red numbers"),this.red._verify1(this),this.red.sqrt(this)},y.prototype.redInvm=function(){return m(this.red,"redInvm works only with red numbers"),this.red._verify1(this),this.red.invm(this)},y.prototype.redNeg=function(){return m(this.red,"redNeg works only with red numbers"),this.red._verify1(this),this.red.neg(this)},y.prototype.redPow=function(e){return m(this.red&&!e.red,"redPow(normalNum)"),this.red._verify1(this),this.red.pow(this,e)};var l={k256:null,p224:null,p192:null,p25519:null};function f(e,t){this.name=e,this.p=new y(t,16),this.n=this.p.bitLength(),this.k=new y(1).iushln(this.n).isub(this.p),this.tmp=this._tmp()}function v(){f.call(this,"k256","ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f")}function g(){f.call(this,"p224","ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001")}function b(){f.call(this,"p192","ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff")}function w(){f.call(this,"25519","7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed")}function _(e){if("string"==typeof e){var t=y._prime(e);this.m=t.p,this.prime=t}else m(e.gtn(1),"modulus must be greater than 1"),this.m=e,this.prime=null}function M(e){_.call(this,e),this.shift=this.m.bitLength(),this.shift%26!=0&&(this.shift+=26-this.shift%26),this.r=new y(1).iushln(this.shift),this.r2=this.imod(this.r.sqr()),this.rinv=this.r._invmp(this.m),this.minv=this.rinv.mul(this.r).isubn(1).div(this.m),this.minv=this.minv.umod(this.r),this.minv=this.r.sub(this.minv)}f.prototype._tmp=function(){var e=new y(null);return e.words=new Array(Math.ceil(this.n/13)),e},f.prototype.ireduce=function(e){for(var t,r=e;this.split(r,this.tmp),(t=(r=(r=this.imulK(r)).iadd(this.tmp)).bitLength())>this.n;);var n=t<this.n?-1:r.ucmp(this.p);return 0===n?(r.words[0]=0,r.length=1):0<n?r.isub(this.p):r.strip(),r},f.prototype.split=function(e,t){e.iushrn(this.n,0,t)},f.prototype.imulK=function(e){return e.imul(this.k)},r(v,f),v.prototype.split=function(e,t){for(var r=Math.min(e.length,9),n=0;n<r;n++)t.words[n]=e.words[n];if(t.length=r,e.length<=9)return e.words[0]=0,void(e.length=1);var i=e.words[9];for(t.words[t.length++]=4194303&i,n=10;n<e.length;n++){var o=0|e.words[n];e.words[n-10]=(4194303&o)<<4|i>>>22,i=o}i>>>=22,0===(e.words[n-10]=i)&&10<e.length?e.length-=10:e.length-=9},v.prototype.imulK=function(e){e.words[e.length]=0,e.words[e.length+1]=0,e.length+=2;for(var t=0,r=0;r<e.length;r++){var n=0|e.words[r];t+=977*n,e.words[r]=67108863&t,t=64*n+(t/67108864|0)}return 0===e.words[e.length-1]&&(e.length--,0===e.words[e.length-1]&&e.length--),e},r(g,f),r(b,f),r(w,f),w.prototype.imulK=function(e){for(var t=0,r=0;r<e.length;r++){var n=19*(0|e.words[r])+t,i=67108863&n;n>>>=26,e.words[r]=i,t=n}return 0!==t&&(e.words[e.length++]=t),e},y._prime=function(e){if(l[e])return l[e];var t;if("k256"===e)t=new v;else if("p224"===e)t=new g;else if("p192"===e)t=new b;else{if("p25519"!==e)throw new Error("Unknown prime "+e);t=new w}return l[e]=t},_.prototype._verify1=function(e){m(0===e.negative,"red works only with positives"),m(e.red,"red works only with red numbers")},_.prototype._verify2=function(e,t){m(0==(e.negative|t.negative),"red works only with positives"),m(e.red&&e.red===t.red,"red works only with red numbers")},_.prototype.imod=function(e){return this.prime?this.prime.ireduce(e)._forceRed(this):e.umod(this.m)._forceRed(this)},_.prototype.neg=function(e){return e.isZero()?e.clone():this.m.sub(e)._forceRed(this)},_.prototype.add=function(e,t){this._verify2(e,t);var r=e.add(t);return 0<=r.cmp(this.m)&&r.isub(this.m),r._forceRed(this)},_.prototype.iadd=function(e,t){this._verify2(e,t);var r=e.iadd(t);return 0<=r.cmp(this.m)&&r.isub(this.m),r},_.prototype.sub=function(e,t){this._verify2(e,t);var r=e.sub(t);return r.cmpn(0)<0&&r.iadd(this.m),r._forceRed(this)},_.prototype.isub=function(e,t){this._verify2(e,t);var r=e.isub(t);return r.cmpn(0)<0&&r.iadd(this.m),r},_.prototype.shl=function(e,t){return this._verify1(e),this.imod(e.ushln(t))},_.prototype.imul=function(e,t){return this._verify2(e,t),this.imod(e.imul(t))},_.prototype.mul=function(e,t){return this._verify2(e,t),this.imod(e.mul(t))},_.prototype.isqr=function(e){return this.imul(e,e.clone())},_.prototype.sqr=function(e){return this.mul(e,e)},_.prototype.sqrt=function(e){if(e.isZero())return e.clone();var t=this.m.andln(3);if(m(t%2==1),3===t){var r=this.m.add(new y(1)).iushrn(2);return this.pow(e,r)}for(var n=this.m.subn(1),i=0;!n.isZero()&&0===n.andln(1);)i++,n.iushrn(1);m(!n.isZero());var o=new y(1).toRed(this),s=o.redNeg(),a=this.m.subn(1).iushrn(1),u=this.m.bitLength();for(u=new y(2*u*u).toRed(this);0!==this.pow(u,a).cmp(s);)u.redIAdd(s);for(var l=this.pow(u,n),f=this.pow(e,n.addn(1).iushrn(1)),h=this.pow(e,n),c=i;0!==h.cmp(o);){for(var d=h,p=0;0!==d.cmp(o);p++)d=d.redSqr();m(p<c);var v=this.pow(l,new y(1).iushln(c-p-1));f=f.redMul(v),l=v.redSqr(),h=h.redMul(l),c=p}return f},_.prototype.invm=function(e){var t=e._invmp(this.m);return 0!==t.negative?(t.negative=0,this.imod(t).redNeg()):this.imod(t)},_.prototype.pow=function(e,t){if(t.isZero())return new y(1).toRed(this);if(0===t.cmpn(1))return e.clone();var r=new Array(16);r[0]=new y(1).toRed(this),r[1]=e;for(var n=2;n<r.length;n++)r[n]=this.mul(r[n-1],e);var i=r[0],o=0,s=0,a=t.bitLength()%26;for(0===a&&(a=26),n=t.length-1;0<=n;n--){for(var u=t.words[n],l=a-1;0<=l;l--){var f=u>>l&1;i!==r[0]&&(i=this.sqr(i)),0!==f||0!==o?(o<<=1,o|=f,(4===++s||0===n&&0===l)&&(i=this.mul(i,r[o]),o=s=0)):s=0}a=26}return i},_.prototype.convertTo=function(e){var t=e.umod(this.m);return t===e?t.clone():t},_.prototype.convertFrom=function(e){var t=e.clone();return t.red=null,t},y.mont=function(e){return new M(e)},r(M,_),M.prototype.convertTo=function(e){return this.imod(e.ushln(this.shift))},M.prototype.convertFrom=function(e){var t=this.imod(e.mul(this.rinv));return t.red=null,t},M.prototype.imul=function(e,t){if(e.isZero()||t.isZero())return e.words[0]=0,e.length=1,e;var r=e.imul(t),n=r.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),i=r.isub(n).iushrn(this.shift),o=i;return 0<=i.cmp(this.m)?o=i.isub(this.m):i.cmpn(0)<0&&(o=i.iadd(this.m)),o._forceRed(this)},M.prototype.mul=function(e,t){if(e.isZero()||t.isZero())return new y(0)._forceRed(this);var r=e.mul(t),n=r.maskn(this.shift).mul(this.minv).imaskn(this.shift).mul(this.m),i=r.isub(n).iushrn(this.shift),o=i;return 0<=i.cmp(this.m)?o=i.isub(this.m):i.cmpn(0)<0&&(o=i.iadd(this.m)),o._forceRed(this)},M.prototype.invm=function(e){return this.imod(e._invmp(this.m).mul(this.r2))._forceRed(this)}}(void 0===e||e,this)},{buffer:11}],10:[function(e,t,r){(function(r){t.exports=function(e){var t=new Uint8Array(e);return(r.crypto||r.msCrypto).getRandomValues(t),t}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],11:[function(e,t,r){},{}],12:[function(e,t,r){"use strict";var n=r;n.version=e("../package.json").version,n.utils=e("./elliptic/utils"),n.rand=e("brorand"),n.hmacDRBG=e("./elliptic/hmac-drbg"),n.curve=e("./elliptic/curve"),n.curves=e("./elliptic/curves"),n.ec=e("./elliptic/ec"),n.eddsa=e("./elliptic/eddsa")},{"../package.json":26,"./elliptic/curve":15,"./elliptic/curves":18,"./elliptic/ec":19,"./elliptic/eddsa":22,"./elliptic/hmac-drbg":23,"./elliptic/utils":25,brorand:10}],13:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("../../elliptic").utils,S=i.getNAF,k=i.getJSF,h=i.assert;function o(e,t){this.type=e,this.p=new n(t.p,16),this.red=t.prime?n.red(t.prime):n.mont(this.p),this.zero=new n(0).toRed(this.red),this.one=new n(1).toRed(this.red),this.two=new n(2).toRed(this.red),this.n=t.n&&new n(t.n,16),this.g=t.g&&this.pointFromJSON(t.g,t.gRed),this._wnafT1=new Array(4),this._wnafT2=new Array(4),this._wnafT3=new Array(4),this._wnafT4=new Array(4);var r=this.n&&this.p.div(this.n);!r||0<r.cmpn(100)?this.redN=null:(this._maxwellTrick=!0,this.redN=this.n.toRed(this.red))}function s(e,t){this.curve=e,this.type=t,this.precomputed=null}(t.exports=o).prototype.point=function(){throw new Error("Not implemented")},o.prototype.validate=function(){throw new Error("Not implemented")},o.prototype._fixedNafMul=function(e,t){h(e.precomputed);var r=e._getDoubles(),n=S(t,1),i=(1<<r.step+1)-(r.step%2==0?2:1);i/=3;for(var o=[],s=0;s<n.length;s+=r.step){var a=0;for(t=s+r.step-1;s<=t;t--)a=(a<<1)+n[t];o.push(a)}for(var u=this.jpoint(null,null,null),l=this.jpoint(null,null,null),f=i;0<f;f--){for(s=0;s<o.length;s++){(a=o[s])===f?l=l.mixedAdd(r.points[s]):a===-f&&(l=l.mixedAdd(r.points[s].neg()))}u=u.add(l)}return u.toP()},o.prototype._wnafMul=function(e,t){var r=4,n=e._getNAFPoints(r);r=n.wnd;for(var i=n.points,o=S(t,r),s=this.jpoint(null,null,null),a=o.length-1;0<=a;a--){for(t=0;0<=a&&0===o[a];a--)t++;if(0<=a&&t++,s=s.dblp(t),a<0)break;var u=o[a];h(0!==u),s="affine"===e.type?0<u?s.mixedAdd(i[u-1>>1]):s.mixedAdd(i[-u-1>>1].neg()):0<u?s.add(i[u-1>>1]):s.add(i[-u-1>>1].neg())}return"affine"===e.type?s.toP():s},o.prototype._wnafMulAdd=function(e,t,r,n,i){for(var o=this._wnafT1,s=this._wnafT2,a=this._wnafT3,u=0,l=0;l<n;l++){var f=(A=t[l])._getNAFPoints(e);o[l]=f.wnd,s[l]=f.points}for(l=n-1;1<=l;l-=2){var h=l-1,c=l;if(1===o[h]&&1===o[c]){var d=[t[h],null,null,t[c]];0===t[h].y.cmp(t[c].y)?(d[1]=t[h].add(t[c]),d[2]=t[h].toJ().mixedAdd(t[c].neg())):0===t[h].y.cmp(t[c].y.redNeg())?(d[1]=t[h].toJ().mixedAdd(t[c]),d[2]=t[h].add(t[c].neg())):(d[1]=t[h].toJ().mixedAdd(t[c]),d[2]=t[h].toJ().mixedAdd(t[c].neg()));var p=[-3,-1,-5,-7,0,7,5,1,3],v=k(r[h],r[c]);u=Math.max(v[0].length,u),a[h]=new Array(u),a[c]=new Array(u);for(var m=0;m<u;m++){var y=0|v[0][m],g=0|v[1][m];a[h][m]=p[3*(y+1)+(g+1)],a[c][m]=0,s[h]=d}}else a[h]=S(r[h],o[h]),a[c]=S(r[c],o[c]),u=Math.max(a[h].length,u),u=Math.max(a[c].length,u)}var b=this.jpoint(null,null,null),w=this._wnafT4;for(l=u;0<=l;l--){for(var _=0;0<=l;){var M=!0;for(m=0;m<n;m++)w[m]=0|a[m][l],0!==w[m]&&(M=!1);if(!M)break;_++,l--}if(0<=l&&_++,b=b.dblp(_),l<0)break;for(m=0;m<n;m++){var A,E=w[m];0!==E&&(0<E?A=s[m][E-1>>1]:E<0&&(A=s[m][-E-1>>1].neg()),b="affine"===A.type?b.mixedAdd(A):b.add(A))}}for(l=0;l<n;l++)s[l]=null;return i?b:b.toP()},(o.BasePoint=s).prototype.eq=function(){throw new Error("Not implemented")},s.prototype.validate=function(){return this.curve.validate(this)},o.prototype.decodePoint=function(e,t){e=i.toArray(e,t);var r=this.p.byteLength();if((4===e[0]||6===e[0]||7===e[0])&&e.length-1==2*r)return 6===e[0]?h(e[e.length-1]%2==0):7===e[0]&&h(e[e.length-1]%2==1),this.point(e.slice(1,1+r),e.slice(1+r,1+2*r));if((2===e[0]||3===e[0])&&e.length-1===r)return this.pointFromX(e.slice(1,1+r),3===e[0]);throw new Error("Unknown point format")},s.prototype.encodeCompressed=function(e){return this.encode(e,!0)},s.prototype._encode=function(e){var t=this.curve.p.byteLength(),r=this.getX().toArray("be",t);return e?[this.getY().isEven()?2:3].concat(r):[4].concat(r,this.getY().toArray("be",t))},s.prototype.encode=function(e,t){return i.encode(this._encode(t),e)},s.prototype.precompute=function(e){if(this.precomputed)return this;var t={doubles:null,naf:null,beta:null};return t.naf=this._getNAFPoints(8),t.doubles=this._getDoubles(4,e),t.beta=this._getBeta(),this.precomputed=t,this},s.prototype._hasDoubles=function(e){if(!this.precomputed)return!1;var t=this.precomputed.doubles;return!!t&&t.points.length>=Math.ceil((e.bitLength()+1)/t.step)},s.prototype._getDoubles=function(e,t){if(this.precomputed&&this.precomputed.doubles)return this.precomputed.doubles;for(var r=[this],n=this,i=0;i<t;i+=e){for(var o=0;o<e;o++)n=n.dbl();r.push(n)}return{step:e,points:r}},s.prototype._getNAFPoints=function(e){if(this.precomputed&&this.precomputed.naf)return this.precomputed.naf;for(var t=[this],r=(1<<e)-1,n=1===r?null:this.dbl(),i=1;i<r;i++)t[i]=t[i-1].add(n);return{wnd:e,points:t}},s.prototype._getBeta=function(){return null},s.prototype.dblp=function(e){for(var t=this,r=0;r<e;r++)t=t.dbl();return t}},{"../../elliptic":12,"bn.js":9}],14:[function(e,t,r){t.exports={}},{}],15:[function(e,t,r){"use strict";var n=r;n.base=e("./base"),n.short=e("./short"),n.mont=e("./mont"),n.edwards=e("./edwards")},{"./base":13,"./edwards":14,"./mont":16,"./short":17}],16:[function(e,t,r){arguments[4][14][0].apply(r,arguments)},{dup:14}],17:[function(e,t,r){"use strict";var n=e("../curve"),i=e("../../elliptic"),_=e("bn.js"),o=e("inherits"),s=n.base,a=i.utils.assert;function u(e){s.call(this,"short",e),this.a=new _(e.a,16).toRed(this.red),this.b=new _(e.b,16).toRed(this.red),this.tinv=this.two.redInvm(),this.zeroA=0===this.a.fromRed().cmpn(0),this.threeA=0===this.a.fromRed().sub(this.p).cmpn(-3),this.endo=this._getEndomorphism(e),this._endoWnafT1=new Array(4),this._endoWnafT2=new Array(4)}function l(e,t,r,n){s.BasePoint.call(this,e,"affine"),null===t&&null===r?(this.x=null,this.y=null,this.inf=!0):(this.x=new _(t,16),this.y=new _(r,16),n&&(this.x.forceRed(this.curve.red),this.y.forceRed(this.curve.red)),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.inf=!1)}function f(e,t,r,n){s.BasePoint.call(this,e,"jacobian"),null===t&&null===r&&null===n?(this.x=this.curve.one,this.y=this.curve.one,this.z=new _(0)):(this.x=new _(t,16),this.y=new _(r,16),this.z=new _(n,16)),this.x.red||(this.x=this.x.toRed(this.curve.red)),this.y.red||(this.y=this.y.toRed(this.curve.red)),this.z.red||(this.z=this.z.toRed(this.curve.red)),this.zOne=this.z===this.curve.one}o(u,s),(t.exports=u).prototype._getEndomorphism=function(e){if(this.zeroA&&this.g&&this.n&&1===this.p.modn(3)){var t,r;if(e.beta)t=new _(e.beta,16).toRed(this.red);else{var n=this._getEndoRoots(this.p);t=(t=n[0].cmp(n[1])<0?n[0]:n[1]).toRed(this.red)}if(e.lambda)r=new _(e.lambda,16);else{var i=this._getEndoRoots(this.n);0===this.g.mul(i[0]).x.cmp(this.g.x.redMul(t))?r=i[0]:(r=i[1],a(0===this.g.mul(r).x.cmp(this.g.x.redMul(t))))}return{beta:t,lambda:r,basis:e.basis?e.basis.map(function(e){return{a:new _(e.a,16),b:new _(e.b,16)}}):this._getEndoBasis(r)}}},u.prototype._getEndoRoots=function(e){var t=e===this.p?this.red:_.mont(e),r=new _(2).toRed(t).redInvm(),n=r.redNeg(),i=new _(3).toRed(t).redNeg().redSqrt().redMul(r);return[n.redAdd(i).fromRed(),n.redSub(i).fromRed()]},u.prototype._getEndoBasis=function(e){for(var t,r,n,i,o,s,a,u,l,f=this.n.ushrn(Math.floor(this.n.bitLength()/2)),h=e,c=this.n.clone(),d=new _(1),p=new _(0),v=new _(0),m=new _(1),y=0;0!==h.cmpn(0);){var g=c.div(h);u=c.sub(g.mul(h)),l=v.sub(g.mul(d));var b=m.sub(g.mul(p));if(!n&&u.cmp(f)<0)t=a.neg(),r=d,n=u.neg(),i=l;else if(n&&2==++y)break;c=h,h=a=u,v=d,d=l,m=p,p=b}o=u.neg(),s=l;var w=n.sqr().add(i.sqr());return 0<=o.sqr().add(s.sqr()).cmp(w)&&(o=t,s=r),n.negative&&(n=n.neg(),i=i.neg()),o.negative&&(o=o.neg(),s=s.neg()),[{a:n,b:i},{a:o,b:s}]},u.prototype._endoSplit=function(e){var t=this.endo.basis,r=t[0],n=t[1],i=n.b.mul(e).divRound(this.n),o=r.b.neg().mul(e).divRound(this.n),s=i.mul(r.a),a=o.mul(n.a),u=i.mul(r.b),l=o.mul(n.b);return{k1:e.sub(s).sub(a),k2:u.add(l).neg()}},u.prototype.pointFromX=function(e,t){(e=new _(e,16)).red||(e=e.toRed(this.red));var r=e.redSqr().redMul(e).redIAdd(e.redMul(this.a)).redIAdd(this.b),n=r.redSqrt();if(0!==n.redSqr().redSub(r).cmp(this.zero))throw new Error("invalid point");var i=n.fromRed().isOdd();return(t&&!i||!t&&i)&&(n=n.redNeg()),this.point(e,n)},u.prototype.validate=function(e){if(e.inf)return!0;var t=e.x,r=e.y,n=this.a.redMul(t),i=t.redSqr().redMul(t).redIAdd(n).redIAdd(this.b);return 0===r.redSqr().redISub(i).cmpn(0)},u.prototype._endoWnafMulAdd=function(e,t,r){for(var n=this._endoWnafT1,i=this._endoWnafT2,o=0;o<e.length;o++){var s=this._endoSplit(t[o]),a=e[o],u=a._getBeta();s.k1.negative&&(s.k1.ineg(),a=a.neg(!0)),s.k2.negative&&(s.k2.ineg(),u=u.neg(!0)),n[2*o]=a,n[2*o+1]=u,i[2*o]=s.k1,i[2*o+1]=s.k2}for(var l=this._wnafMulAdd(1,n,i,2*o,r),f=0;f<2*o;f++)n[f]=null,i[f]=null;return l},o(l,s.BasePoint),u.prototype.point=function(e,t,r){return new l(this,e,t,r)},u.prototype.pointFromJSON=function(e,t){return l.fromJSON(this,e,t)},l.prototype._getBeta=function(){if(this.curve.endo){var e=this.precomputed;if(e&&e.beta)return e.beta;var t=this.curve.point(this.x.redMul(this.curve.endo.beta),this.y);if(e){var r=this.curve,n=function(e){return r.point(e.x.redMul(r.endo.beta),e.y)};(e.beta=t).precomputed={beta:null,naf:e.naf&&{wnd:e.naf.wnd,points:e.naf.points.map(n)},doubles:e.doubles&&{step:e.doubles.step,points:e.doubles.points.map(n)}}}return t}},l.prototype.toJSON=function(){return this.precomputed?[this.x,this.y,this.precomputed&&{doubles:this.precomputed.doubles&&{step:this.precomputed.doubles.step,points:this.precomputed.doubles.points.slice(1)},naf:this.precomputed.naf&&{wnd:this.precomputed.naf.wnd,points:this.precomputed.naf.points.slice(1)}}]:[this.x,this.y]},l.fromJSON=function(t,e,r){"string"==typeof e&&(e=JSON.parse(e));var n=t.point(e[0],e[1],r);if(!e[2])return n;function i(e){return t.point(e[0],e[1],r)}var o=e[2];return n.precomputed={beta:null,doubles:o.doubles&&{step:o.doubles.step,points:[n].concat(o.doubles.points.map(i))},naf:o.naf&&{wnd:o.naf.wnd,points:[n].concat(o.naf.points.map(i))}},n},l.prototype.inspect=function(){return this.isInfinity()?"<EC Point Infinity>":"<EC Point x: "+this.x.fromRed().toString(16,2)+" y: "+this.y.fromRed().toString(16,2)+">"},l.prototype.isInfinity=function(){return this.inf},l.prototype.add=function(e){if(this.inf)return e;if(e.inf)return this;if(this.eq(e))return this.dbl();if(this.neg().eq(e))return this.curve.point(null,null);if(0===this.x.cmp(e.x))return this.curve.point(null,null);var t=this.y.redSub(e.y);0!==t.cmpn(0)&&(t=t.redMul(this.x.redSub(e.x).redInvm()));var r=t.redSqr().redISub(this.x).redISub(e.x),n=t.redMul(this.x.redSub(r)).redISub(this.y);return this.curve.point(r,n)},l.prototype.dbl=function(){if(this.inf)return this;var e=this.y.redAdd(this.y);if(0===e.cmpn(0))return this.curve.point(null,null);var t=this.curve.a,r=this.x.redSqr(),n=e.redInvm(),i=r.redAdd(r).redIAdd(r).redIAdd(t).redMul(n),o=i.redSqr().redISub(this.x.redAdd(this.x)),s=i.redMul(this.x.redSub(o)).redISub(this.y);return this.curve.point(o,s)},l.prototype.getX=function(){return this.x.fromRed()},l.prototype.getY=function(){return this.y.fromRed()},l.prototype.mul=function(e){return e=new _(e,16),this._hasDoubles(e)?this.curve._fixedNafMul(this,e):this.curve.endo?this.curve._endoWnafMulAdd([this],[e]):this.curve._wnafMul(this,e)},l.prototype.mulAdd=function(e,t,r){var n=[this,t],i=[e,r];return this.curve.endo?this.curve._endoWnafMulAdd(n,i):this.curve._wnafMulAdd(1,n,i,2)},l.prototype.jmulAdd=function(e,t,r){var n=[this,t],i=[e,r];return this.curve.endo?this.curve._endoWnafMulAdd(n,i,!0):this.curve._wnafMulAdd(1,n,i,2,!0)},l.prototype.eq=function(e){return this===e||this.inf===e.inf&&(this.inf||0===this.x.cmp(e.x)&&0===this.y.cmp(e.y))},l.prototype.neg=function(e){if(this.inf)return this;var t=this.curve.point(this.x,this.y.redNeg());if(e&&this.precomputed){var r=this.precomputed,n=function(e){return e.neg()};t.precomputed={naf:r.naf&&{wnd:r.naf.wnd,points:r.naf.points.map(n)},doubles:r.doubles&&{step:r.doubles.step,points:r.doubles.points.map(n)}}}return t},l.prototype.toJ=function(){return this.inf?this.curve.jpoint(null,null,null):this.curve.jpoint(this.x,this.y,this.curve.one)},o(f,s.BasePoint),u.prototype.jpoint=function(e,t,r){return new f(this,e,t,r)},f.prototype.toP=function(){if(this.isInfinity())return this.curve.point(null,null);var e=this.z.redInvm(),t=e.redSqr(),r=this.x.redMul(t),n=this.y.redMul(t).redMul(e);return this.curve.point(r,n)},f.prototype.neg=function(){return this.curve.jpoint(this.x,this.y.redNeg(),this.z)},f.prototype.add=function(e){if(this.isInfinity())return e;if(e.isInfinity())return this;var t=e.z.redSqr(),r=this.z.redSqr(),n=this.x.redMul(t),i=e.x.redMul(r),o=this.y.redMul(t.redMul(e.z)),s=e.y.redMul(r.redMul(this.z)),a=n.redSub(i),u=o.redSub(s);if(0===a.cmpn(0))return 0!==u.cmpn(0)?this.curve.jpoint(null,null,null):this.dbl();var l=a.redSqr(),f=l.redMul(a),h=n.redMul(l),c=u.redSqr().redIAdd(f).redISub(h).redISub(h),d=u.redMul(h.redISub(c)).redISub(o.redMul(f)),p=this.z.redMul(e.z).redMul(a);return this.curve.jpoint(c,d,p)},f.prototype.mixedAdd=function(e){if(this.isInfinity())return e.toJ();if(e.isInfinity())return this;var t=this.z.redSqr(),r=this.x,n=e.x.redMul(t),i=this.y,o=e.y.redMul(t).redMul(this.z),s=r.redSub(n),a=i.redSub(o);if(0===s.cmpn(0))return 0!==a.cmpn(0)?this.curve.jpoint(null,null,null):this.dbl();var u=s.redSqr(),l=u.redMul(s),f=r.redMul(u),h=a.redSqr().redIAdd(l).redISub(f).redISub(f),c=a.redMul(f.redISub(h)).redISub(i.redMul(l)),d=this.z.redMul(s);return this.curve.jpoint(h,c,d)},f.prototype.dblp=function(e){if(0===e)return this;if(this.isInfinity())return this;if(!e)return this.dbl();if(this.curve.zeroA||this.curve.threeA){for(var t=this,r=0;r<e;r++)t=t.dbl();return t}var n=this.curve.a,i=this.curve.tinv,o=this.x,s=this.y,a=this.z,u=a.redSqr().redSqr(),l=s.redAdd(s);for(r=0;r<e;r++){var f=o.redSqr(),h=l.redSqr(),c=h.redSqr(),d=f.redAdd(f).redIAdd(f).redIAdd(n.redMul(u)),p=o.redMul(h),v=d.redSqr().redISub(p.redAdd(p)),m=p.redISub(v),y=d.redMul(m);y=y.redIAdd(y).redISub(c);var g=l.redMul(a);r+1<e&&(u=u.redMul(c)),o=v,a=g,l=y}return this.curve.jpoint(o,l.redMul(i),a)},f.prototype.dbl=function(){return this.isInfinity()?this:this.curve.zeroA?this._zeroDbl():this.curve.threeA?this._threeDbl():this._dbl()},f.prototype._zeroDbl=function(){var e,t,r;if(this.zOne){var n=this.x.redSqr(),i=this.y.redSqr(),o=i.redSqr(),s=this.x.redAdd(i).redSqr().redISub(n).redISub(o);s=s.redIAdd(s);var a=n.redAdd(n).redIAdd(n),u=a.redSqr().redISub(s).redISub(s),l=o.redIAdd(o);l=(l=l.redIAdd(l)).redIAdd(l),e=u,t=a.redMul(s.redISub(u)).redISub(l),r=this.y.redAdd(this.y)}else{var f=this.x.redSqr(),h=this.y.redSqr(),c=h.redSqr(),d=this.x.redAdd(h).redSqr().redISub(f).redISub(c);d=d.redIAdd(d);var p=f.redAdd(f).redIAdd(f),v=p.redSqr(),m=c.redIAdd(c);m=(m=m.redIAdd(m)).redIAdd(m),e=v.redISub(d).redISub(d),t=p.redMul(d.redISub(e)).redISub(m),r=(r=this.y.redMul(this.z)).redIAdd(r)}return this.curve.jpoint(e,t,r)},f.prototype._threeDbl=function(){var e,t,r;if(this.zOne){var n=this.x.redSqr(),i=this.y.redSqr(),o=i.redSqr(),s=this.x.redAdd(i).redSqr().redISub(n).redISub(o);s=s.redIAdd(s);var a=n.redAdd(n).redIAdd(n).redIAdd(this.curve.a),u=a.redSqr().redISub(s).redISub(s);e=u;var l=o.redIAdd(o);l=(l=l.redIAdd(l)).redIAdd(l),t=a.redMul(s.redISub(u)).redISub(l),r=this.y.redAdd(this.y)}else{var f=this.z.redSqr(),h=this.y.redSqr(),c=this.x.redMul(h),d=this.x.redSub(f).redMul(this.x.redAdd(f));d=d.redAdd(d).redIAdd(d);var p=c.redIAdd(c),v=(p=p.redIAdd(p)).redAdd(p);e=d.redSqr().redISub(v),r=this.y.redAdd(this.z).redSqr().redISub(h).redISub(f);var m=h.redSqr();m=(m=(m=m.redIAdd(m)).redIAdd(m)).redIAdd(m),t=d.redMul(p.redISub(e)).redISub(m)}return this.curve.jpoint(e,t,r)},f.prototype._dbl=function(){var e=this.curve.a,t=this.x,r=this.y,n=this.z,i=n.redSqr().redSqr(),o=t.redSqr(),s=r.redSqr(),a=o.redAdd(o).redIAdd(o).redIAdd(e.redMul(i)),u=t.redAdd(t),l=(u=u.redIAdd(u)).redMul(s),f=a.redSqr().redISub(l.redAdd(l)),h=l.redISub(f),c=s.redSqr();c=(c=(c=c.redIAdd(c)).redIAdd(c)).redIAdd(c);var d=a.redMul(h).redISub(c),p=r.redAdd(r).redMul(n);return this.curve.jpoint(f,d,p)},f.prototype.trpl=function(){if(!this.curve.zeroA)return this.dbl().add(this);var e=this.x.redSqr(),t=this.y.redSqr(),r=this.z.redSqr(),n=t.redSqr(),i=e.redAdd(e).redIAdd(e),o=i.redSqr(),s=this.x.redAdd(t).redSqr().redISub(e).redISub(n),a=(s=(s=(s=s.redIAdd(s)).redAdd(s).redIAdd(s)).redISub(o)).redSqr(),u=n.redIAdd(n);u=(u=(u=u.redIAdd(u)).redIAdd(u)).redIAdd(u);var l=i.redIAdd(s).redSqr().redISub(o).redISub(a).redISub(u),f=t.redMul(l);f=(f=f.redIAdd(f)).redIAdd(f);var h=this.x.redMul(a).redISub(f);h=(h=h.redIAdd(h)).redIAdd(h);var c=this.y.redMul(l.redMul(u.redISub(l)).redISub(s.redMul(a)));c=(c=(c=c.redIAdd(c)).redIAdd(c)).redIAdd(c);var d=this.z.redAdd(s).redSqr().redISub(r).redISub(a);return this.curve.jpoint(h,c,d)},f.prototype.mul=function(e,t){return e=new _(e,t),this.curve._wnafMul(this,e)},f.prototype.eq=function(e){if("affine"===e.type)return this.eq(e.toJ());if(this===e)return!0;var t=this.z.redSqr(),r=e.z.redSqr();if(0!==this.x.redMul(r).redISub(e.x.redMul(t)).cmpn(0))return!1;var n=t.redMul(this.z),i=r.redMul(e.z);return 0===this.y.redMul(i).redISub(e.y.redMul(n)).cmpn(0)},f.prototype.eqXToP=function(e){var t=this.z.redSqr(),r=e.toRed(this.curve.red).redMul(t);if(0===this.x.cmp(r))return!0;for(var n=e.clone(),i=this.curve.redN.redMul(t);;){if(n.iadd(this.curve.n),0<=n.cmp(this.curve.p))return!1;if(r.redIAdd(i),0===this.x.cmp(r))return!0}return!1},f.prototype.inspect=function(){return this.isInfinity()?"<EC JPoint Infinity>":"<EC JPoint x: "+this.x.toString(16,2)+" y: "+this.y.toString(16,2)+" z: "+this.z.toString(16,2)+">"},f.prototype.isInfinity=function(){return 0===this.z.cmpn(0)}},{"../../elliptic":12,"../curve":15,"bn.js":9,inherits:39}],18:[function(e,t,r){"use strict";var n,i=r,o=e("hash.js"),s=e("../elliptic"),a=s.utils.assert;function u(e){"short"===e.type?this.curve=new s.curve.short(e):"edwards"===e.type?this.curve=new s.curve.edwards(e):this.curve=new s.curve.mont(e),this.g=this.curve.g,this.n=this.curve.n,this.hash=e.hash,a(this.g.validate(),"Invalid curve"),a(this.g.mul(this.n).isInfinity(),"Invalid curve, G*N != O")}function l(t,r){Object.defineProperty(i,t,{configurable:!0,enumerable:!0,get:function(){var e=new u(r);return Object.defineProperty(i,t,{configurable:!0,enumerable:!0,value:e}),e}})}i.PresetCurve=u,l("p192",{type:"short",prime:"p192",p:"ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff",a:"ffffffff ffffffff ffffffff fffffffe ffffffff fffffffc",b:"64210519 e59c80e7 0fa7e9ab 72243049 feb8deec c146b9b1",n:"ffffffff ffffffff ffffffff 99def836 146bc9b1 b4d22831",hash:o.sha256,gRed:!1,g:["188da80e b03090f6 7cbf20eb 43a18800 f4ff0afd 82ff1012","07192b95 ffc8da78 631011ed 6b24cdd5 73f977a1 1e794811"]}),l("p224",{type:"short",prime:"p224",p:"ffffffff ffffffff ffffffff ffffffff 00000000 00000000 00000001",a:"ffffffff ffffffff ffffffff fffffffe ffffffff ffffffff fffffffe",b:"b4050a85 0c04b3ab f5413256 5044b0b7 d7bfd8ba 270b3943 2355ffb4",n:"ffffffff ffffffff ffffffff ffff16a2 e0b8f03e 13dd2945 5c5c2a3d",hash:o.sha256,gRed:!1,g:["b70e0cbd 6bb4bf7f 321390b9 4a03c1d3 56c21122 343280d6 115c1d21","bd376388 b5f723fb 4c22dfe6 cd4375a0 5a074764 44d58199 85007e34"]}),l("p256",{type:"short",prime:null,p:"ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff ffffffff",a:"ffffffff 00000001 00000000 00000000 00000000 ffffffff ffffffff fffffffc",b:"5ac635d8 aa3a93e7 b3ebbd55 769886bc 651d06b0 cc53b0f6 3bce3c3e 27d2604b",n:"ffffffff 00000000 ffffffff ffffffff bce6faad a7179e84 f3b9cac2 fc632551",hash:o.sha256,gRed:!1,g:["6b17d1f2 e12c4247 f8bce6e5 63a440f2 77037d81 2deb33a0 f4a13945 d898c296","4fe342e2 fe1a7f9b 8ee7eb4a 7c0f9e16 2bce3357 6b315ece cbb64068 37bf51f5"]}),l("p384",{type:"short",prime:null,p:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 ffffffff",a:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe ffffffff 00000000 00000000 fffffffc",b:"b3312fa7 e23ee7e4 988e056b e3f82d19 181d9c6e fe814112 0314088f 5013875a c656398d 8a2ed19d 2a85c8ed d3ec2aef",n:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff c7634d81 f4372ddf 581a0db2 48b0a77a ecec196a ccc52973",hash:o.sha384,gRed:!1,g:["aa87ca22 be8b0537 8eb1c71e f320ad74 6e1d3b62 8ba79b98 59f741e0 82542a38 5502f25d bf55296c 3a545e38 72760ab7","3617de4a 96262c6f 5d9e98bf 9292dc29 f8f41dbd 289a147c e9da3113 b5f0b8c0 0a60b1ce 1d7e819d 7a431d7c 90ea0e5f"]}),l("p521",{type:"short",prime:null,p:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff",a:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffc",b:"00000051 953eb961 8e1c9a1f 929a21a0 b68540ee a2da725b 99b315f3 b8b48991 8ef109e1 56193951 ec7e937b 1652c0bd 3bb1bf07 3573df88 3d2c34f1 ef451fd4 6b503f00",n:"000001ff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffa 51868783 bf2f966b 7fcc0148 f709a5d0 3bb5c9b8 899c47ae bb6fb71e 91386409",hash:o.sha512,gRed:!1,g:["000000c6 858e06b7 0404e9cd 9e3ecb66 2395b442 9c648139 053fb521 f828af60 6b4d3dba a14b5e77 efe75928 fe1dc127 a2ffa8de 3348b3c1 856a429b f97e7e31 c2e5bd66","00000118 39296a78 9a3bc004 5c8a5fb4 2c7d1bd9 98f54449 579b4468 17afbd17 273e662c 97ee7299 5ef42640 c550b901 3fad0761 353c7086 a272c240 88be9476 9fd16650"]}),l("curve25519",{type:"mont",prime:"p25519",p:"7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",a:"76d06",b:"1",n:"1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",hash:o.sha256,gRed:!1,g:["9"]}),l("ed25519",{type:"edwards",prime:"p25519",p:"7fffffffffffffff ffffffffffffffff ffffffffffffffff ffffffffffffffed",a:"-1",c:"1",d:"52036cee2b6ffe73 8cc740797779e898 00700a4d4141d8ab 75eb4dca135978a3",n:"1000000000000000 0000000000000000 14def9dea2f79cd6 5812631a5cf5d3ed",hash:o.sha256,gRed:!1,g:["216936d3cd6e53fec0a4e231fdd6dc5c692cc7609525a7b2c9562d608f25d51a","6666666666666666666666666666666666666666666666666666666666666658"]});try{n=e("./precomputed/secp256k1")}catch(e){n=void 0}l("secp256k1",{type:"short",prime:"k256",p:"ffffffff ffffffff ffffffff ffffffff ffffffff ffffffff fffffffe fffffc2f",a:"0",b:"7",n:"ffffffff ffffffff ffffffff fffffffe baaedce6 af48a03b bfd25e8c d0364141",h:"1",hash:o.sha256,beta:"7ae96a2b657c07106e64479eac3434e99cf0497512f58995c1396c28719501ee",lambda:"5363ad4cc05c30e0a5261c028812645a122e22ea20816678df02967c1b23bd72",basis:[{a:"3086d221a7d46bcde86c90e49284eb15",b:"-e4437ed6010e88286f547fa90abfe4c3"},{a:"114ca50f7a8e2f3f657c1108d9d44cfd8",b:"3086d221a7d46bcde86c90e49284eb15"}],gRed:!1,g:["79be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798","483ada7726a3c4655da4fbfc0e1108a8fd17b448a68554199c47d08ffb10d4b8",n]})},{"../elliptic":12,"./precomputed/secp256k1":24,"hash.js":27}],19:[function(e,t,r){"use strict";var m=e("bn.js"),y=e("../../elliptic"),d=y.utils.assert,n=e("./key"),g=e("./signature");function i(e){if(!(this instanceof i))return new i(e);"string"==typeof e&&(d(y.curves.hasOwnProperty(e),"Unknown curve "+e),e=y.curves[e]),e instanceof y.curves.PresetCurve&&(e={curve:e}),this.curve=e.curve.curve,this.n=this.curve.n,this.nh=this.n.ushrn(1),this.g=this.curve.g,this.g=e.curve.g,this.g.precompute(e.curve.n.bitLength()+1),this.hash=e.hash||e.curve.hash}(t.exports=i).prototype.keyPair=function(e){return new n(this,e)},i.prototype.keyFromPrivate=function(e,t){return n.fromPrivate(this,e,t)},i.prototype.keyFromPublic=function(e,t){return n.fromPublic(this,e,t)},i.prototype.genKeyPair=function(e){e||(e={});for(var t=new y.hmacDRBG({hash:this.hash,pers:e.pers,entropy:e.entropy||y.rand(this.hash.hmacStrength),nonce:this.n.toArray()}),r=this.n.byteLength(),n=this.n.sub(new m(2));;){var i=new m(t.generate(r));if(!(0<i.cmp(n)))return i.iaddn(1),this.keyFromPrivate(i)}},i.prototype._truncateToN=function(e,t){var r=8*e.byteLength()-this.n.bitLength();return 0<r&&(e=e.ushrn(r)),!t&&0<=e.cmp(this.n)?e.sub(this.n):e},i.prototype.sign=function(e,t,r,n){"object"==typeof r&&(n=r,r=null),n||(n={}),t=this.keyFromPrivate(t,r),e=this._truncateToN(new m(e,16));for(var i=this.n.byteLength(),o=t.getPrivate().toArray("be",i),s=e.toArray("be",i),a=new y.hmacDRBG({hash:this.hash,entropy:o,nonce:s,pers:n.pers,persEnc:n.persEnc}),u=this.n.sub(new m(1)),l=0;;l++){var f=n.k?n.k(l):new m(a.generate(this.n.byteLength()));if(!((f=this._truncateToN(f,!0)).cmpn(1)<=0||0<=f.cmp(u))){var h=this.g.mul(f);if(!h.isInfinity()){var c=h.getX(),d=c.umod(this.n);if(0!==d.cmpn(0)){var p=f.invm(this.n).mul(d.mul(t.getPrivate()).iadd(e));if(0!==(p=p.umod(this.n)).cmpn(0)){var v=(h.getY().isOdd()?1:0)|(0!==c.cmp(d)?2:0);return n.canonical&&0<p.cmp(this.nh)&&(p=this.n.sub(p),v^=1),new g({r:d,s:p,recoveryParam:v})}}}}}},i.prototype.verify=function(e,t,r,n){e=this._truncateToN(new m(e,16)),r=this.keyFromPublic(r,n);var i=(t=new g(t,"hex")).r,o=t.s;if(i.cmpn(1)<0||0<=i.cmp(this.n))return!1;if(o.cmpn(1)<0||0<=o.cmp(this.n))return!1;var s,a=o.invm(this.n),u=a.mul(e).umod(this.n),l=a.mul(i).umod(this.n);return this.curve._maxwellTrick?!(s=this.g.jmulAdd(u,r.getPublic(),l)).isInfinity()&&s.eqXToP(i):!(s=this.g.mulAdd(u,r.getPublic(),l)).isInfinity()&&0===s.getX().umod(this.n).cmp(i)},i.prototype.recoverPubKey=function(e,t,r,n){d((3&r)===r,"The recovery param is more than two bits"),t=new g(t,n);var i=this.n,o=new m(e),s=t.r,a=t.s,u=1&r,l=r>>1;if(0<=s.cmp(this.curve.p.umod(this.curve.n))&&l)throw new Error("Unable to find sencond key candinate");s=l?this.curve.pointFromX(s.add(this.curve.n),u):this.curve.pointFromX(s,u);var f=t.r.invm(i),h=i.sub(o).mul(f).umod(i),c=a.mul(f).umod(i);return this.g.mulAdd(h,s,c)},i.prototype.getKeyRecoveryParam=function(e,t,r,n){if(null!==(t=new g(t,n)).recoveryParam)return t.recoveryParam;for(var i=0;i<4;i++){var o;try{o=this.recoverPubKey(e,t,i)}catch(e){continue}if(o.eq(r))return i}throw new Error("Unable to find valid recovery factor")}},{"../../elliptic":12,"./key":20,"./signature":21,"bn.js":9}],20:[function(e,t,r){"use strict";var n=e("bn.js"),i=e("../../elliptic").utils.assert;function o(e,t){this.ec=e,this.priv=null,this.pub=null,t.priv&&this._importPrivate(t.priv,t.privEnc),t.pub&&this._importPublic(t.pub,t.pubEnc)}(t.exports=o).fromPublic=function(e,t,r){return t instanceof o?t:new o(e,{pub:t,pubEnc:r})},o.fromPrivate=function(e,t,r){return t instanceof o?t:new o(e,{priv:t,privEnc:r})},o.prototype.validate=function(){var e=this.getPublic();return e.isInfinity()?{result:!1,reason:"Invalid public key"}:e.validate()?e.mul(this.ec.curve.n).isInfinity()?{result:!0,reason:null}:{result:!1,reason:"Public key * N != O"}:{result:!1,reason:"Public key is not a point"}},o.prototype.getPublic=function(e,t){return"string"==typeof e&&(t=e,e=null),this.pub||(this.pub=this.ec.g.mul(this.priv)),t?this.pub.encode(t,e):this.pub},o.prototype.getPrivate=function(e){return"hex"===e?this.priv.toString(16,2):this.priv},o.prototype._importPrivate=function(e,t){this.priv=new n(e,t||16),this.priv=this.priv.umod(this.ec.curve.n)},o.prototype._importPublic=function(e,t){if(e.x||e.y)return"mont"===this.ec.curve.type?i(e.x,"Need x coordinate"):"short"!==this.ec.curve.type&&"edwards"!==this.ec.curve.type||i(e.x&&e.y,"Need both x and y coordinate"),void(this.pub=this.ec.curve.point(e.x,e.y));this.pub=this.ec.curve.decodePoint(e,t)},o.prototype.derive=function(e){return e.mul(this.priv).getX()},o.prototype.sign=function(e,t,r){return this.ec.sign(e,this,t,r)},o.prototype.verify=function(e,t){return this.ec.verify(e,t,this)},o.prototype.inspect=function(){return"<Key priv: "+(this.priv&&this.priv.toString(16,2))+" pub: "+(this.pub&&this.pub.inspect())+" >"}},{"../../elliptic":12,"bn.js":9}],21:[function(e,t,r){"use strict";var a=e("bn.js"),u=e("../../elliptic").utils,n=u.assert;function i(e,t){if(e instanceof i)return e;this._importDER(e,t)||(n(e.r&&e.s,"Signature without r or s"),this.r=new a(e.r,16),this.s=new a(e.s,16),void 0===e.recoveryParam?this.recoveryParam=null:this.recoveryParam=e.recoveryParam)}function l(){this.place=0}function f(e,t){var r=e[t.place++];if(!(128&r))return r;for(var n=15&r,i=0,o=0,s=t.place;o<n;o++,s++)i<<=8,i|=e[s];return t.place=s,i}function s(e){for(var t=0,r=e.length-1;!e[t]&&!(128&e[t+1])&&t<r;)t++;return 0===t?e:e.slice(t)}function h(e,t){if(t<128)e.push(t);else{var r=1+(Math.log(t)/Math.LN2>>>3);for(e.push(128|r);--r;)e.push(t>>>(r<<3)&255);e.push(t)}}(t.exports=i).prototype._importDER=function(e,t){e=u.toArray(e,t);var r=new l;if(48!==e[r.place++])return!1;if(f(e,r)+r.place!==e.length)return!1;if(2!==e[r.place++])return!1;var n=f(e,r),i=e.slice(r.place,n+r.place);if(r.place+=n,2!==e[r.place++])return!1;var o=f(e,r);if(e.length!==o+r.place)return!1;var s=e.slice(r.place,o+r.place);return 0===i[0]&&128&i[1]&&(i=i.slice(1)),0===s[0]&&128&s[1]&&(s=s.slice(1)),this.r=new a(i),this.s=new a(s),!(this.recoveryParam=null)},i.prototype.toDER=function(e){var t=this.r.toArray(),r=this.s.toArray();for(128&t[0]&&(t=[0].concat(t)),128&r[0]&&(r=[0].concat(r)),t=s(t),r=s(r);!(r[0]||128&r[1]);)r=r.slice(1);var n=[2];h(n,t.length),(n=n.concat(t)).push(2),h(n,r.length);var i=n.concat(r),o=[48];return h(o,i.length),o=o.concat(i),u.encode(o,e)}},{"../../elliptic":12,"bn.js":9}],22:[function(e,t,r){arguments[4][14][0].apply(r,arguments)},{dup:14}],23:[function(e,t,r){"use strict";var n=e("hash.js"),s=e("../elliptic").utils,i=s.assert;function o(e){if(!(this instanceof o))return new o(e);this.hash=e.hash,this.predResist=!!e.predResist,this.outLen=this.hash.outSize,this.minEntropy=e.minEntropy||this.hash.hmacStrength,this.reseed=null,this.reseedInterval=null,this.K=null,this.V=null;var t=s.toArray(e.entropy,e.entropyEnc),r=s.toArray(e.nonce,e.nonceEnc),n=s.toArray(e.pers,e.persEnc);i(t.length>=this.minEntropy/8,"Not enough entropy. Minimum is: "+this.minEntropy+" bits"),this._init(t,r,n)}(t.exports=o).prototype._init=function(e,t,r){var n=e.concat(t).concat(r);this.K=new Array(this.outLen/8),this.V=new Array(this.outLen/8);for(var i=0;i<this.V.length;i++)this.K[i]=0,this.V[i]=1;this._update(n),this.reseed=1,this.reseedInterval=281474976710656},o.prototype._hmac=function(){return new n.hmac(this.hash,this.K)},o.prototype._update=function(e){var t=this._hmac().update(this.V).update([0]);e&&(t=t.update(e)),this.K=t.digest(),this.V=this._hmac().update(this.V).digest(),e&&(this.K=this._hmac().update(this.V).update([1]).update(e).digest(),this.V=this._hmac().update(this.V).digest())},o.prototype.reseed=function(e,t,r,n){"string"!=typeof t&&(n=r,r=t,t=null),e=s.toBuffer(e,t),r=s.toBuffer(r,n),i(e.length>=this.minEntropy/8,"Not enough entropy. Minimum is: "+this.minEntropy+" bits"),this._update(e.concat(r||[])),this.reseed=1},o.prototype.generate=function(e,t,r,n){if(this.reseed>this.reseedInterval)throw new Error("Reseed is required");"string"!=typeof t&&(n=r,r=t,t=null),r&&(r=s.toArray(r,n),this._update(r));for(var i=[];i.length<e;)this.V=this._hmac().update(this.V).digest(),i=i.concat(this.V);var o=i.slice(0,e);return this._update(r),this.reseed++,s.encode(o,t)}},{"../elliptic":12,"hash.js":27}],24:[function(e,t,r){t.exports=void 0},{}],25:[function(e,t,r){"use strict";var n=r,i=e("bn.js");function o(e){return 1===e.length?"0"+e:e}function s(e){for(var t="",r=0;r<e.length;r++)t+=o(e[r].toString(16));return t}n.assert=function(e,t){if(!e)throw new Error(t||"Assertion failed")},n.toArray=function(e,t){if(Array.isArray(e))return e.slice();if(!e)return[];var r=[];if("string"!=typeof e){for(var n=0;n<e.length;n++)r[n]=0|e[n];return r}if(t){if("hex"===t)for((e=e.replace(/[^a-z0-9]+/gi,"")).length%2!=0&&(e="0"+e),n=0;n<e.length;n+=2)r.push(parseInt(e[n]+e[n+1],16))}else for(var n=0;n<e.length;n++){var i=e.charCodeAt(n),o=i>>8,s=255&i;o?r.push(o,s):r.push(s)}return r},n.zero2=o,n.toHex=s,n.encode=function(e,t){return"hex"===t?s(e):e},n.getNAF=function(e,t){for(var r=[],n=1<<t+1,i=e.clone();0<=i.cmpn(1);){var o;if(i.isOdd()){var s=i.andln(n-1);o=(n>>1)-1<s?(n>>1)-s:s,i.isubn(o)}else o=0;r.push(o);for(var a=0!==i.cmpn(0)&&0===i.andln(n-1)?t+1:1,u=1;u<a;u++)r.push(0);i.iushrn(a)}return r},n.getJSF=function(e,t){var r=[[],[]];e=e.clone(),t=t.clone();for(var n=0,i=0;0<e.cmpn(-n)||0<t.cmpn(-i);){var o,s,a,u=e.andln(3)+n&3,l=t.andln(3)+i&3;3===u&&(u=-1),3===l&&(l=-1),o=0==(1&u)?0:3!=(a=e.andln(7)+n&7)&&5!==a||2!==l?u:-u,r[0].push(o),s=0==(1&l)?0:3!=(a=t.andln(7)+i&7)&&5!==a||2!==u?l:-l,r[1].push(s),2*n===o+1&&(n=1-n),2*i===s+1&&(i=1-i),e.iushrn(1),t.iushrn(1)}return r},n.cachedProperty=function(e,t,r){var n="_"+t;e.prototype[t]=function(){return void 0!==this[n]?this[n]:this[n]=r.call(this)}},n.parseBytes=function(e){return"string"==typeof e?n.toArray(e,"hex"):e},n.intFromLE=function(e){return new i(e,"hex","le")}},{"bn.js":9}],26:[function(e,t,r){t.exports={version:"6.3.3"}},{}],27:[function(e,t,r){var n=r;n.utils=e("./hash/utils"),n.common=e("./hash/common"),n.sha=e("./hash/sha"),n.ripemd=e("./hash/ripemd"),n.hmac=e("./hash/hmac"),n.sha1=n.sha.sha1,n.sha256=n.sha.sha256,n.sha224=n.sha.sha224,n.sha384=n.sha.sha384,n.sha512=n.sha.sha512,n.ripemd160=n.ripemd.ripemd160},{"./hash/common":28,"./hash/hmac":29,"./hash/ripemd":30,"./hash/sha":31,"./hash/utils":38}],28:[function(e,t,r){"use strict";var i=e("./utils"),n=e("minimalistic-assert");function o(){this.pending=null,this.pendingTotal=0,this.blockSize=this.constructor.blockSize,this.outSize=this.constructor.outSize,this.hmacStrength=this.constructor.hmacStrength,this.padLength=this.constructor.padLength/8,this.endian="big",this._delta8=this.blockSize/8,this._delta32=this.blockSize/32}(r.BlockHash=o).prototype.update=function(e,t){if(e=i.toArray(e,t),this.pending?this.pending=this.pending.concat(e):this.pending=e,this.pendingTotal+=e.length,this.pending.length>=this._delta8){var r=(e=this.pending).length%this._delta8;this.pending=e.slice(e.length-r,e.length),0===this.pending.length&&(this.pending=null),e=i.join32(e,0,e.length-r,this.endian);for(var n=0;n<e.length;n+=this._delta32)this._update(e,n,n+this._delta32)}return this},o.prototype.digest=function(e){return this.update(this._pad()),n(null===this.pending),this._digest(e)},o.prototype._pad=function(){var e=this.pendingTotal,t=this._delta8,r=t-(e+this.padLength)%t,n=new Array(r+this.padLength);n[0]=128;for(var i=1;i<r;i++)n[i]=0;if(e<<=3,"big"===this.endian){for(var o=8;o<this.padLength;o++)n[i++]=0;n[i++]=0,n[i++]=0,n[i++]=0,n[i++]=0,n[i++]=e>>>24&255,n[i++]=e>>>16&255,n[i++]=e>>>8&255,n[i++]=255&e}else for(n[i++]=255&e,n[i++]=e>>>8&255,n[i++]=e>>>16&255,n[i++]=e>>>24&255,n[i++]=0,n[i++]=0,n[i++]=0,n[i++]=0,o=8;o<this.padLength;o++)n[i++]=0;return n}},{"./utils":38,"minimalistic-assert":41}],29:[function(e,t,r){"use strict";var n=e("./utils"),i=e("minimalistic-assert");function o(e,t,r){if(!(this instanceof o))return new o(e,t,r);this.Hash=e,this.blockSize=e.blockSize/8,this.outSize=e.outSize/8,this.inner=null,this.outer=null,this._init(n.toArray(t,r))}(t.exports=o).prototype._init=function(e){e.length>this.blockSize&&(e=(new this.Hash).update(e).digest()),i(e.length<=this.blockSize);for(var t=e.length;t<this.blockSize;t++)e.push(0);for(t=0;t<e.length;t++)e[t]^=54;for(this.inner=(new this.Hash).update(e),t=0;t<e.length;t++)e[t]^=106;this.outer=(new this.Hash).update(e)},o.prototype.update=function(e,t){return this.inner.update(e,t),this},o.prototype.digest=function(e){return this.outer.update(this.inner.digest()),this.outer.digest(e)}},{"./utils":38,"minimalistic-assert":41}],30:[function(e,t,r){t.exports={ripemd160:null}},{}],31:[function(e,t,r){"use strict";r.sha1=e("./sha/1"),r.sha224=e("./sha/224"),r.sha256=e("./sha/256"),r.sha384=e("./sha/384"),r.sha512=e("./sha/512")},{"./sha/1":32,"./sha/224":33,"./sha/256":34,"./sha/384":35,"./sha/512":36}],32:[function(e,t,r){arguments[4][14][0].apply(r,arguments)},{dup:14}],33:[function(e,t,r){arguments[4][14][0].apply(r,arguments)},{dup:14}],34:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../common"),o=e("./common"),p=e("minimalistic-assert"),v=n.sum32,m=n.sum32_4,y=n.sum32_5,g=o.ch32,b=o.maj32,w=o.s0_256,_=o.s1_256,M=o.g0_256,A=o.g1_256,s=i.BlockHash,a=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298];function u(){if(!(this instanceof u))return new u;s.call(this),this.h=[1779033703,3144134277,1013904242,2773480762,1359893119,2600822924,528734635,1541459225],this.k=a,this.W=new Array(64)}n.inherits(u,s),(t.exports=u).blockSize=512,u.outSize=256,u.hmacStrength=192,u.padLength=64,u.prototype._update=function(e,t){for(var r=this.W,n=0;n<16;n++)r[n]=e[t+n];for(;n<r.length;n++)r[n]=m(A(r[n-2]),r[n-7],M(r[n-15]),r[n-16]);var i=this.h[0],o=this.h[1],s=this.h[2],a=this.h[3],u=this.h[4],l=this.h[5],f=this.h[6],h=this.h[7];for(p(this.k.length===r.length),n=0;n<r.length;n++){var c=y(h,_(u),g(u,l,f),this.k[n],r[n]),d=v(w(i),b(i,o,s));h=f,f=l,l=u,u=v(a,c),a=s,s=o,o=i,i=v(c,d)}this.h[0]=v(this.h[0],i),this.h[1]=v(this.h[1],o),this.h[2]=v(this.h[2],s),this.h[3]=v(this.h[3],a),this.h[4]=v(this.h[4],u),this.h[5]=v(this.h[5],l),this.h[6]=v(this.h[6],f),this.h[7]=v(this.h[7],h)},u.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h,"big"):n.split32(this.h,"big")}},{"../common":28,"../utils":38,"./common":37,"minimalistic-assert":41}],35:[function(e,t,r){arguments[4][14][0].apply(r,arguments)},{dup:14}],36:[function(e,t,r){"use strict";var n=e("../utils"),i=e("../common"),C=e("minimalistic-assert"),o=n.rotr64_hi,s=n.rotr64_lo,a=n.shr64_hi,u=n.shr64_lo,B=n.sum64,D=n.sum64_hi,L=n.sum64_lo,c=n.sum64_4_hi,d=n.sum64_4_lo,U=n.sum64_5_hi,F=n.sum64_5_lo,l=i.BlockHash,f=[1116352408,3609767458,1899447441,602891725,3049323471,3964484399,3921009573,2173295548,961987163,4081628472,1508970993,3053834265,2453635748,2937671579,2870763221,3664609560,3624381080,2734883394,310598401,1164996542,607225278,1323610764,1426881987,3590304994,1925078388,4068182383,2162078206,991336113,2614888103,633803317,3248222580,3479774868,3835390401,2666613458,4022224774,944711139,264347078,2341262773,604807628,2007800933,770255983,1495990901,1249150122,1856431235,1555081692,3175218132,1996064986,2198950837,2554220882,3999719339,2821834349,766784016,2952996808,2566594879,3210313671,3203337956,3336571891,1034457026,3584528711,2466948901,113926993,3758326383,338241895,168717936,666307205,1188179964,773529912,1546045734,1294757372,1522805485,1396182291,2643833823,1695183700,2343527390,1986661051,1014477480,2177026350,1206759142,2456956037,344077627,2730485921,1290863460,2820302411,3158454273,3259730800,3505952657,3345764771,106217008,3516065817,3606008344,3600352804,1432725776,4094571909,1467031594,275423344,851169720,430227734,3100823752,506948616,1363258195,659060556,3750685593,883997877,3785050280,958139571,3318307427,1322822218,3812723403,1537002063,2003034995,1747873779,3602036899,1955562222,1575990012,2024104815,1125592928,2227730452,2716904306,2361852424,442776044,2428436474,593698344,2756734187,3733110249,3204031479,2999351573,3329325298,3815920427,3391569614,3928383900,3515267271,566280711,3940187606,3454069534,4118630271,4000239992,116418474,1914138554,174292421,2731055270,289380356,3203993006,460393269,320620315,685471733,587496836,852142971,1086792851,1017036298,365543100,1126000580,2618297676,1288033470,3409855158,1501505948,4234509866,1607167915,987167468,1816402316,1246189591];function h(){if(!(this instanceof h))return new h;l.call(this),this.h=[1779033703,4089235720,3144134277,2227873595,1013904242,4271175723,2773480762,1595750129,1359893119,2917565137,2600822924,725511199,528734635,4215389547,1541459225,327033209],this.k=f,this.W=new Array(160)}function j(e,t,r,n,i){var o=e&r^~e&i;return o<0&&(o+=4294967296),o}function G(e,t,r,n,i,o){var s=t&n^~t&o;return s<0&&(s+=4294967296),s}function z(e,t,r,n,i){var o=e&r^e&i^r&i;return o<0&&(o+=4294967296),o}function H(e,t,r,n,i,o){var s=t&n^t&o^n&o;return s<0&&(s+=4294967296),s}function V(e,t){var r=o(e,t,28)^o(t,e,2)^o(t,e,7);return r<0&&(r+=4294967296),r}function q(e,t){var r=s(e,t,28)^s(t,e,2)^s(t,e,7);return r<0&&(r+=4294967296),r}function K(e,t){var r=o(e,t,14)^o(e,t,18)^o(t,e,9);return r<0&&(r+=4294967296),r}function W(e,t){var r=s(e,t,14)^s(e,t,18)^s(t,e,9);return r<0&&(r+=4294967296),r}function p(e,t){var r=o(e,t,1)^o(e,t,8)^a(e,t,7);return r<0&&(r+=4294967296),r}function v(e,t){var r=s(e,t,1)^s(e,t,8)^u(e,t,7);return r<0&&(r+=4294967296),r}function m(e,t){var r=o(e,t,19)^o(t,e,29)^a(e,t,6);return r<0&&(r+=4294967296),r}function y(e,t){var r=s(e,t,19)^s(t,e,29)^u(e,t,6);return r<0&&(r+=4294967296),r}n.inherits(h,l),(t.exports=h).blockSize=1024,h.outSize=512,h.hmacStrength=192,h.padLength=128,h.prototype._prepareBlock=function(e,t){for(var r=this.W,n=0;n<32;n++)r[n]=e[t+n];for(;n<r.length;n+=2){var i=m(r[n-4],r[n-3]),o=y(r[n-4],r[n-3]),s=r[n-14],a=r[n-13],u=p(r[n-30],r[n-29]),l=v(r[n-30],r[n-29]),f=r[n-32],h=r[n-31];r[n]=c(i,o,s,a,u,l,f,h),r[n+1]=d(i,o,s,a,u,l,f,h)}},h.prototype._update=function(e,t){this._prepareBlock(e,t);var r=this.W,n=this.h[0],i=this.h[1],o=this.h[2],s=this.h[3],a=this.h[4],u=this.h[5],l=this.h[6],f=this.h[7],h=this.h[8],c=this.h[9],d=this.h[10],p=this.h[11],v=this.h[12],m=this.h[13],y=this.h[14],g=this.h[15];C(this.k.length===r.length);for(var b=0;b<r.length;b+=2){var w=y,_=g,M=K(h,c),A=W(h,c),E=j(h,c,d,p,v),S=G(h,c,d,p,v,m),k=this.k[b],N=this.k[b+1],P=r[b],x=r[b+1],I=U(w,_,M,A,E,S,k,N,P,x),T=F(w,_,M,A,E,S,k,N,P,x);w=V(n,i),_=q(n,i),M=z(n,i,o,s,a),A=H(n,i,o,s,a,u);var R=D(w,_,M,A),O=L(w,_,M,A);y=v,g=m,v=d,m=p,d=h,p=c,h=D(l,f,I,T),c=L(f,f,I,T),l=a,f=u,a=o,u=s,o=n,s=i,n=D(I,T,R,O),i=L(I,T,R,O)}B(this.h,0,n,i),B(this.h,2,o,s),B(this.h,4,a,u),B(this.h,6,l,f),B(this.h,8,h,c),B(this.h,10,d,p),B(this.h,12,v,m),B(this.h,14,y,g)},h.prototype._digest=function(e){return"hex"===e?n.toHex32(this.h,"big"):n.split32(this.h,"big")}},{"../common":28,"../utils":38,"minimalistic-assert":41}],37:[function(e,t,r){"use strict";var n=e("../utils").rotr32;function i(e,t,r){return e&t^~e&r}function o(e,t,r){return e&t^e&r^t&r}function s(e,t,r){return e^t^r}r.ft_1=function(e,t,r,n){return 0===e?i(t,r,n):1===e||3===e?s(t,r,n):2===e?o(t,r,n):void 0},r.ch32=i,r.maj32=o,r.p32=s,r.s0_256=function(e){return n(e,2)^n(e,13)^n(e,22)},r.s1_256=function(e){return n(e,6)^n(e,11)^n(e,25)},r.g0_256=function(e){return n(e,7)^n(e,18)^e>>>3},r.g1_256=function(e){return n(e,17)^n(e,19)^e>>>10}},{"../utils":38}],38:[function(e,t,r){"use strict";var l=e("minimalistic-assert"),n=e("inherits");function o(e){return(e>>>24|e>>>8&65280|e<<8&16711680|(255&e)<<24)>>>0}function i(e){return 1===e.length?"0"+e:e}function s(e){return 7===e.length?"0"+e:6===e.length?"00"+e:5===e.length?"000"+e:4===e.length?"0000"+e:3===e.length?"00000"+e:2===e.length?"000000"+e:1===e.length?"0000000"+e:e}r.inherits=n,r.toArray=function(e,t){if(Array.isArray(e))return e.slice();if(!e)return[];var r=[];if("string"==typeof e)if(t){if("hex"===t)for((e=e.replace(/[^a-z0-9]+/gi,"")).length%2!=0&&(e="0"+e),n=0;n<e.length;n+=2)r.push(parseInt(e[n]+e[n+1],16))}else for(var n=0;n<e.length;n++){var i=e.charCodeAt(n),o=i>>8,s=255&i;o?r.push(o,s):r.push(s)}else for(n=0;n<e.length;n++)r[n]=0|e[n];return r},r.toHex=function(e){for(var t="",r=0;r<e.length;r++)t+=i(e[r].toString(16));return t},r.htonl=o,r.toHex32=function(e,t){for(var r="",n=0;n<e.length;n++){var i=e[n];"little"===t&&(i=o(i)),r+=s(i.toString(16))}return r},r.zero2=i,r.zero8=s,r.join32=function(e,t,r,n){var i=r-t;l(i%4==0);for(var o=new Array(i/4),s=0,a=t;s<o.length;s++,a+=4){var u;u="big"===n?e[a]<<24|e[a+1]<<16|e[a+2]<<8|e[a+3]:e[a+3]<<24|e[a+2]<<16|e[a+1]<<8|e[a],o[s]=u>>>0}return o},r.split32=function(e,t){for(var r=new Array(4*e.length),n=0,i=0;n<e.length;n++,i+=4){var o=e[n];"big"===t?(r[i]=o>>>24,r[i+1]=o>>>16&255,r[i+2]=o>>>8&255,r[i+3]=255&o):(r[i+3]=o>>>24,r[i+2]=o>>>16&255,r[i+1]=o>>>8&255,r[i]=255&o)}return r},r.rotr32=function(e,t){return e>>>t|e<<32-t},r.rotl32=function(e,t){return e<<t|e>>>32-t},r.sum32=function(e,t){return e+t>>>0},r.sum32_3=function(e,t,r){return e+t+r>>>0},r.sum32_4=function(e,t,r,n){return e+t+r+n>>>0},r.sum32_5=function(e,t,r,n,i){return e+t+r+n+i>>>0},r.sum64=function(e,t,r,n){var i=e[t],o=n+e[t+1]>>>0,s=(o<n?1:0)+r+i;e[t]=s>>>0,e[t+1]=o},r.sum64_hi=function(e,t,r,n){return(t+n>>>0<t?1:0)+e+r>>>0},r.sum64_lo=function(e,t,r,n){return t+n>>>0},r.sum64_4_hi=function(e,t,r,n,i,o,s,a){var u=0,l=t;return u+=(l=l+n>>>0)<t?1:0,u+=(l=l+o>>>0)<o?1:0,e+r+i+s+(u+=(l=l+a>>>0)<a?1:0)>>>0},r.sum64_4_lo=function(e,t,r,n,i,o,s,a){return t+n+o+a>>>0},r.sum64_5_hi=function(e,t,r,n,i,o,s,a,u,l){var f=0,h=t;return f+=(h=h+n>>>0)<t?1:0,f+=(h=h+o>>>0)<o?1:0,f+=(h=h+a>>>0)<a?1:0,e+r+i+s+u+(f+=(h=h+l>>>0)<l?1:0)>>>0},r.sum64_5_lo=function(e,t,r,n,i,o,s,a,u,l){return t+n+o+a+l>>>0},r.rotr64_hi=function(e,t,r){return(t<<32-r|e>>>r)>>>0},r.rotr64_lo=function(e,t,r){return(e<<32-r|t>>>r)>>>0},r.shr64_hi=function(e,t,r){return e>>>r},r.shr64_lo=function(e,t,r){return(e<<32-r|t>>>r)>>>0}},{inherits:39,"minimalistic-assert":41}],39:[function(e,t,r){"function"==typeof Object.create?t.exports=function(e,t){e.super_=t,e.prototype=Object.create(t.prototype,{constructor:{value:e,enumerable:!1,writable:!0,configurable:!0}})}:t.exports=function(e,t){e.super_=t;var r=function(){};r.prototype=t.prototype,e.prototype=new r,e.prototype.constructor=e}},{}],40:[function(e,_,t){(function(b,w){!function(){"use strict";var e="object"==typeof window?window:{};!e.JS_SHA3_NO_NODE_JS&&"object"==typeof b&&b.versions&&b.versions.node&&(e=w);for(var t=!e.JS_SHA3_NO_COMMON_JS&&"object"==typeof _&&_.exports,u="0123456789abcdef".split(""),f=[0,8,16,24],fe=[1,0,32898,0,32906,2147483648,2147516416,2147483648,32907,0,2147483649,0,2147516545,2147483648,32777,2147483648,138,0,136,0,2147516425,0,2147483658,0,2147516555,0,139,2147483648,32905,2147483648,32771,2147483648,32770,2147483648,128,2147483648,32778,0,2147483658,2147483648,2147516545,2147483648,32896,2147483648,2147483649,0,2147516424,2147483648],r=[224,256,384,512],o=["hex","buffer","arrayBuffer","array"],s=function(t,r,n){return function(e){return new y(t,r,t).update(e)[n]()}},a=function(r,n,i){return function(e,t){return new y(r,n,t).update(e)[i]()}},n=function(e,t){var r=s(e,t,"hex");r.create=function(){return new y(e,t,e)},r.update=function(e){return r.create().update(e)};for(var n=0;n<o.length;++n){var i=o[n];r[i]=s(e,t,i)}return r},i=[{name:"keccak",padding:[1,256,65536,16777216],bits:r,createMethod:n},{name:"sha3",padding:[6,1536,393216,100663296],bits:r,createMethod:n},{name:"shake",padding:[31,7936,2031616,520093696],bits:[128,256],createMethod:function(t,r){var n=a(t,r,"hex");n.create=function(e){return new y(t,r,e)},n.update=function(e,t){return n.create(t).update(e)};for(var e=0;e<o.length;++e){var i=o[e];n[i]=a(t,r,i)}return n}}],l={},h=[],c=0;c<i.length;++c)for(var d=i[c],p=d.bits,v=0;v<p.length;++v){var m=d.name+"_"+p[v];h.push(m),l[m]=d.createMethod(p[v],d.padding)}function y(e,t,r){this.blocks=[],this.s=[],this.padding=t,this.outputBits=r,this.reset=!0,this.block=0,this.start=0,this.blockCount=1600-(e<<1)>>5,this.byteCount=this.blockCount<<2,this.outputBlocks=r>>5,this.extraBytes=(31&r)>>3;for(var n=0;n<50;++n)this.s[n]=0}y.prototype.update=function(e){var t="string"!=typeof e;t&&e.constructor===ArrayBuffer&&(e=new Uint8Array(e));for(var r,n,i=e.length,o=this.blocks,s=this.byteCount,a=this.blockCount,u=0,l=this.s;u<i;){if(this.reset)for(this.reset=!1,o[0]=this.block,r=1;r<a+1;++r)o[r]=0;if(t)for(r=this.start;u<i&&r<s;++u)o[r>>2]|=e[u]<<f[3&r++];else for(r=this.start;u<i&&r<s;++u)(n=e.charCodeAt(u))<128?o[r>>2]|=n<<f[3&r++]:(n<2048?o[r>>2]|=(192|n>>6)<<f[3&r++]:(n<55296||57344<=n?o[r>>2]|=(224|n>>12)<<f[3&r++]:(n=65536+((1023&n)<<10|1023&e.charCodeAt(++u)),o[r>>2]|=(240|n>>18)<<f[3&r++],o[r>>2]|=(128|n>>12&63)<<f[3&r++]),o[r>>2]|=(128|n>>6&63)<<f[3&r++]),o[r>>2]|=(128|63&n)<<f[3&r++]);if(s<=(this.lastByteIndex=r)){for(this.start=r-s,this.block=o[a],r=0;r<a;++r)l[r]^=o[r];g(l),this.reset=!0}else this.start=r}return this},y.prototype.finalize=function(){var e=this.blocks,t=this.lastByteIndex,r=this.blockCount,n=this.s;if(e[t>>2]|=this.padding[3&t],this.lastByteIndex===this.byteCount)for(e[0]=e[r],t=1;t<r+1;++t)e[t]=0;for(e[r-1]|=2147483648,t=0;t<r;++t)n[t]^=e[t];g(n)},y.prototype.toString=y.prototype.hex=function(){this.finalize();for(var e,t=this.blockCount,r=this.s,n=this.outputBlocks,i=this.extraBytes,o=0,s=0,a="";s<n;){for(o=0;o<t&&s<n;++o,++s)e=r[o],a+=u[e>>4&15]+u[15&e]+u[e>>12&15]+u[e>>8&15]+u[e>>20&15]+u[e>>16&15]+u[e>>28&15]+u[e>>24&15];s%t==0&&(g(r),o=0)}return i&&(e=r[o],0<i&&(a+=u[e>>4&15]+u[15&e]),1<i&&(a+=u[e>>12&15]+u[e>>8&15]),2<i&&(a+=u[e>>20&15]+u[e>>16&15])),a},y.prototype.buffer=y.prototype.arrayBuffer=function(){this.finalize();var e,t=this.blockCount,r=this.s,n=this.outputBlocks,i=this.extraBytes,o=0,s=0,a=this.outputBits>>3;e=i?new ArrayBuffer(n+1<<2):new ArrayBuffer(a);for(var u=new Uint32Array(e);s<n;){for(o=0;o<t&&s<n;++o,++s)u[s]=r[o];s%t==0&&g(r)}return i&&(u[o]=r[o],e=e.slice(0,a)),e},y.prototype.digest=y.prototype.array=function(){this.finalize();for(var e,t,r=this.blockCount,n=this.s,i=this.outputBlocks,o=this.extraBytes,s=0,a=0,u=[];a<i;){for(s=0;s<r&&a<i;++s,++a)e=a<<2,t=n[s],u[e]=255&t,u[e+1]=t>>8&255,u[e+2]=t>>16&255,u[e+3]=t>>24&255;a%r==0&&g(n)}return o&&(e=a<<2,t=n[s],0<o&&(u[e]=255&t),1<o&&(u[e+1]=t>>8&255),2<o&&(u[e+2]=t>>16&255)),u};var g=function(e){var t,r,n,i,o,s,a,u,l,f,h,c,d,p,v,m,y,g,b,w,_,M,A,E,S,k,N,P,x,I,T,R,O,C,B,D,L,U,F,j,G,z,H,V,q,K,W,Z,J,X,$,Q,Y,ee,te,re,ne,ie,oe,se,ae,ue,le;for(n=0;n<48;n+=2)i=e[0]^e[10]^e[20]^e[30]^e[40],o=e[1]^e[11]^e[21]^e[31]^e[41],s=e[2]^e[12]^e[22]^e[32]^e[42],a=e[3]^e[13]^e[23]^e[33]^e[43],u=e[4]^e[14]^e[24]^e[34]^e[44],l=e[5]^e[15]^e[25]^e[35]^e[45],f=e[6]^e[16]^e[26]^e[36]^e[46],h=e[7]^e[17]^e[27]^e[37]^e[47],t=(c=e[8]^e[18]^e[28]^e[38]^e[48])^(s<<1|a>>>31),r=(d=e[9]^e[19]^e[29]^e[39]^e[49])^(a<<1|s>>>31),e[0]^=t,e[1]^=r,e[10]^=t,e[11]^=r,e[20]^=t,e[21]^=r,e[30]^=t,e[31]^=r,e[40]^=t,e[41]^=r,t=i^(u<<1|l>>>31),r=o^(l<<1|u>>>31),e[2]^=t,e[3]^=r,e[12]^=t,e[13]^=r,e[22]^=t,e[23]^=r,e[32]^=t,e[33]^=r,e[42]^=t,e[43]^=r,t=s^(f<<1|h>>>31),r=a^(h<<1|f>>>31),e[4]^=t,e[5]^=r,e[14]^=t,e[15]^=r,e[24]^=t,e[25]^=r,e[34]^=t,e[35]^=r,e[44]^=t,e[45]^=r,t=u^(c<<1|d>>>31),r=l^(d<<1|c>>>31),e[6]^=t,e[7]^=r,e[16]^=t,e[17]^=r,e[26]^=t,e[27]^=r,e[36]^=t,e[37]^=r,e[46]^=t,e[47]^=r,t=f^(i<<1|o>>>31),r=h^(o<<1|i>>>31),e[8]^=t,e[9]^=r,e[18]^=t,e[19]^=r,e[28]^=t,e[29]^=r,e[38]^=t,e[39]^=r,e[48]^=t,e[49]^=r,p=e[0],v=e[1],K=e[11]<<4|e[10]>>>28,W=e[10]<<4|e[11]>>>28,P=e[20]<<3|e[21]>>>29,x=e[21]<<3|e[20]>>>29,se=e[31]<<9|e[30]>>>23,ae=e[30]<<9|e[31]>>>23,z=e[40]<<18|e[41]>>>14,H=e[41]<<18|e[40]>>>14,C=e[2]<<1|e[3]>>>31,B=e[3]<<1|e[2]>>>31,m=e[13]<<12|e[12]>>>20,y=e[12]<<12|e[13]>>>20,Z=e[22]<<10|e[23]>>>22,J=e[23]<<10|e[22]>>>22,I=e[33]<<13|e[32]>>>19,T=e[32]<<13|e[33]>>>19,ue=e[42]<<2|e[43]>>>30,le=e[43]<<2|e[42]>>>30,ee=e[5]<<30|e[4]>>>2,te=e[4]<<30|e[5]>>>2,D=e[14]<<6|e[15]>>>26,L=e[15]<<6|e[14]>>>26,g=e[25]<<11|e[24]>>>21,b=e[24]<<11|e[25]>>>21,X=e[34]<<15|e[35]>>>17,$=e[35]<<15|e[34]>>>17,R=e[45]<<29|e[44]>>>3,O=e[44]<<29|e[45]>>>3,E=e[6]<<28|e[7]>>>4,S=e[7]<<28|e[6]>>>4,re=e[17]<<23|e[16]>>>9,ne=e[16]<<23|e[17]>>>9,U=e[26]<<25|e[27]>>>7,F=e[27]<<25|e[26]>>>7,w=e[36]<<21|e[37]>>>11,_=e[37]<<21|e[36]>>>11,Q=e[47]<<24|e[46]>>>8,Y=e[46]<<24|e[47]>>>8,V=e[8]<<27|e[9]>>>5,q=e[9]<<27|e[8]>>>5,k=e[18]<<20|e[19]>>>12,N=e[19]<<20|e[18]>>>12,ie=e[29]<<7|e[28]>>>25,oe=e[28]<<7|e[29]>>>25,j=e[38]<<8|e[39]>>>24,G=e[39]<<8|e[38]>>>24,M=e[48]<<14|e[49]>>>18,A=e[49]<<14|e[48]>>>18,e[0]=p^~m&g,e[1]=v^~y&b,e[10]=E^~k&P,e[11]=S^~N&x,e[20]=C^~D&U,e[21]=B^~L&F,e[30]=V^~K&Z,e[31]=q^~W&J,e[40]=ee^~re&ie,e[41]=te^~ne&oe,e[2]=m^~g&w,e[3]=y^~b&_,e[12]=k^~P&I,e[13]=N^~x&T,e[22]=D^~U&j,e[23]=L^~F&G,e[32]=K^~Z&X,e[33]=W^~J&$,e[42]=re^~ie&se,e[43]=ne^~oe&ae,e[4]=g^~w&M,e[5]=b^~_&A,e[14]=P^~I&R,e[15]=x^~T&O,e[24]=U^~j&z,e[25]=F^~G&H,e[34]=Z^~X&Q,e[35]=J^~$&Y,e[44]=ie^~se&ue,e[45]=oe^~ae&le,e[6]=w^~M&p,e[7]=_^~A&v,e[16]=I^~R&E,e[17]=T^~O&S,e[26]=j^~z&C,e[27]=G^~H&B,e[36]=X^~Q&V,e[37]=$^~Y&q,e[46]=se^~ue&ee,e[47]=ae^~le&te,e[8]=M^~p&m,e[9]=A^~v&y,e[18]=R^~E&k,e[19]=O^~S&N,e[28]=z^~C&D,e[29]=H^~B&L,e[38]=Q^~V&K,e[39]=Y^~q&W,e[48]=ue^~ee&re,e[49]=le^~te&ne,e[0]^=fe[n],e[1]^=fe[n+1]};if(t)_.exports=l;else for(c=0;c<h.length;++c)e[h[c]]=l[h[c]]}()}).call(this,e("_process"),"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{_process:42}],41:[function(e,t,r){function n(e,t){if(!e)throw new Error(t||"Assertion failed")}(t.exports=n).equal=function(e,t,r){if(e!=t)throw new Error(r||"Assertion failed: "+e+" != "+t)}},{}],42:[function(e,t,r){t.exports={browser:!0}},{}],43:[function(e,r,o){(function(B){"use strict";!function(e){var n=2147483647;function l(e){var m=[1116352408,1899447441,3049323471,3921009573,961987163,1508970993,2453635748,2870763221,3624381080,310598401,607225278,1426881987,1925078388,2162078206,2614888103,3248222580,3835390401,4022224774,264347078,604807628,770255983,1249150122,1555081692,1996064986,2554220882,2821834349,2952996808,3210313671,3336571891,3584528711,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,2177026350,2456956037,2730485921,2820302411,3259730800,3345764771,3516065817,3600352804,4094571909,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,2227730452,2361852424,2428436474,2756734187,3204031479,3329325298],y=1779033703,g=3144134277,b=1013904242,w=2773480762,_=1359893119,M=2600822924,A=528734635,E=1541459225,S=new Array(64);function t(e){for(var t=0,r=e.length;64<=r;){var n,i,o,s,a,u=y,l=g,f=b,h=w,c=_,d=M,p=A,v=E;for(i=0;i<16;i++)o=t+4*i,S[i]=(255&e[o])<<24|(255&e[o+1])<<16|(255&e[o+2])<<8|255&e[o+3];for(i=16;i<64;i++)s=((n=S[i-2])>>>17|n<<15)^(n>>>19|n<<13)^n>>>10,a=((n=S[i-15])>>>7|n<<25)^(n>>>18|n<<14)^n>>>3,S[i]=(s+S[i-7]|0)+(a+S[i-16]|0)|0;for(i=0;i<64;i++)s=(((c>>>6|c<<26)^(c>>>11|c<<21)^(c>>>25|c<<7))+(c&d^~c&p)|0)+(v+(m[i]+S[i]|0)|0)|0,a=((u>>>2|u<<30)^(u>>>13|u<<19)^(u>>>22|u<<10))+(u&l^u&f^l&f)|0,v=p,p=d,d=c,c=h+s|0,h=f,f=l,l=u,u=s+a|0;y=y+u|0,g=g+l|0,b=b+f|0,w=w+h|0,_=_+c|0,M=M+d|0,A=A+p|0,E=E+v|0,t+=64,r-=64}}t(e);var r,n=e.length%64,i=e.length/536870912|0,o=e.length<<3,s=n<56?56:120,a=e.slice(e.length-n,e.length);for(a.push(128),r=n+1;r<s;r++)a.push(0);return a.push(i>>>24&255),a.push(i>>>16&255),a.push(i>>>8&255),a.push(i>>>0&255),a.push(o>>>24&255),a.push(o>>>16&255),a.push(o>>>8&255),a.push(o>>>0&255),t(a),[y>>>24&255,y>>>16&255,y>>>8&255,y>>>0&255,g>>>24&255,g>>>16&255,g>>>8&255,g>>>0&255,b>>>24&255,b>>>16&255,b>>>8&255,b>>>0&255,w>>>24&255,w>>>16&255,w>>>8&255,w>>>0&255,_>>>24&255,_>>>16&255,_>>>8&255,_>>>0&255,M>>>24&255,M>>>16&255,M>>>8&255,M>>>0&255,A>>>24&255,A>>>16&255,A>>>8&255,A>>>0&255,E>>>24&255,E>>>16&255,E>>>8&255,E>>>0&255]}function x(e,t,r){var n;e=e.length<=64?e:l(e);var i=64+t.length+4,o=new Array(i),s=new Array(64),a=[];for(n=0;n<64;n++)o[n]=54;for(n=0;n<e.length;n++)o[n]^=e[n];for(n=0;n<t.length;n++)o[64+n]=t[n];for(n=i-4;n<i;n++)o[n]=0;for(n=0;n<64;n++)s[n]=92;for(n=0;n<e.length;n++)s[n]^=e[n];function u(){for(var e=i-1;i-4<=e;e--){if(o[e]++,o[e]<=255)return;o[e]=0}}for(;32<=r;)u(),a=a.concat(l(s.concat(l(o)))),r-=32;return 0<r&&(u(),a=a.concat(l(s.concat(l(o))).slice(0,r))),a}function I(e,t,r,n,i){var o;for(R(e,16*(2*r-1),i,0,16),o=0;o<2*r;o++)T(e,16*o,i,16),s(i,n),R(i,0,e,t+16*o,16);for(o=0;o<r;o++)R(e,t+2*o*16,e,16*o,16);for(o=0;o<r;o++)R(e,t+16*(2*o+1),e,16*(o+r),16)}function i(e,t){return e<<t|e>>>32-t}function s(e,t){R(e,0,t,0,16);for(var r=8;0<r;r-=2)t[4]^=i(t[0]+t[12],7),t[8]^=i(t[4]+t[0],9),t[12]^=i(t[8]+t[4],13),t[0]^=i(t[12]+t[8],18),t[9]^=i(t[5]+t[1],7),t[13]^=i(t[9]+t[5],9),t[1]^=i(t[13]+t[9],13),t[5]^=i(t[1]+t[13],18),t[14]^=i(t[10]+t[6],7),t[2]^=i(t[14]+t[10],9),t[6]^=i(t[2]+t[14],13),t[10]^=i(t[6]+t[2],18),t[3]^=i(t[15]+t[11],7),t[7]^=i(t[3]+t[15],9),t[11]^=i(t[7]+t[3],13),t[15]^=i(t[11]+t[7],18),t[1]^=i(t[0]+t[3],7),t[2]^=i(t[1]+t[0],9),t[3]^=i(t[2]+t[1],13),t[0]^=i(t[3]+t[2],18),t[6]^=i(t[5]+t[4],7),t[7]^=i(t[6]+t[5],9),t[4]^=i(t[7]+t[6],13),t[5]^=i(t[4]+t[7],18),t[11]^=i(t[10]+t[9],7),t[8]^=i(t[11]+t[10],9),t[9]^=i(t[8]+t[11],13),t[10]^=i(t[9]+t[8],18),t[12]^=i(t[15]+t[14],7),t[13]^=i(t[12]+t[15],9),t[14]^=i(t[13]+t[12],13),t[15]^=i(t[14]+t[13],18);for(r=0;r<16;++r)e[r]+=t[r]}function T(e,t,r,n){for(var i=0;i<n;i++)r[i]^=e[t+i]}function R(e,t,r,n,i){for(;i--;)r[n++]=e[t++]}function O(e){if(!e||"number"!=typeof e.length)return!1;for(var t=0;t<e.length;t++){if("number"!=typeof e[t])return!1;var r=parseInt(e[t]);if(r!=e[t]||r<0||256<=r)return!1}return!0}function C(e,t){var r=parseInt(e);if(e!=r)throw new Error("invalid "+t);return r}function t(o,e,s,a,u,l,f){if(!f)throw new Error("missing callback");if(s=C(s,"N"),a=C(a,"r"),u=C(u,"p"),l=C(l,"dkLen"),0===s||0!=(s&s-1))throw new Error("N must be power of 2");if(n/128/a<s)throw new Error("N too large");if(n/128/u<a)throw new Error("r too large");if(!O(o))throw new Error("password must be an array or buffer");if(o=Array.prototype.slice.call(o),!O(e))throw new Error("salt must be an array or buffer");e=Array.prototype.slice.call(e);for(var h=x(o,e,128*u*a),c=new Uint32Array(32*u*a),t=0;t<c.length;t++){var r=4*t;c[t]=(255&h[r+3])<<24|(255&h[r+2])<<16|(255&h[r+1])<<8|(255&h[r+0])<<0}var d,p,v=new Uint32Array(64*a),m=new Uint32Array(32*a*s),y=32*a,g=new Uint32Array(16),b=new Uint32Array(16),w=u*s*2,_=0,M=null,A=!1,E=0,S=0,k=parseInt(1e3/a),N=void 0!==B?B:setTimeout,P=function(){if(A)return f(new Error("cancelled"),_/w);switch(E){case 0:R(c,p=32*S*a,v,0,y),E=1,d=0;case 1:k<(t=s-d)&&(t=k);for(var e=0;e<t;e++)R(v,0,m,(d+e)*y,y),I(v,y,a,g,b);if(d+=t,_+=t,(r=parseInt(1e3*_/w))!==M){if(A=f(null,_/w))break;M=r}if(d<s)break;d=0,E=2;case 2:var t,r;k<(t=s-d)&&(t=k);for(e=0;e<t;e++){var n=v[16*(2*a-1)]&s-1;T(m,n*y,v,y),I(v,y,a,g,b)}if(d+=t,_+=t,(r=parseInt(1e3*_/w))!==M){if(A=f(null,_/w))break;M=r}if(d<s)break;if(R(v,0,c,p,y),++S<u){E=0;break}h=[];for(e=0;e<c.length;e++)h.push(c[e]>>0&255),h.push(c[e]>>8&255),h.push(c[e]>>16&255),h.push(c[e]>>24&255);var i=x(o,h,l);return f(null,1,i)}N(P)};P()}void 0!==o?r.exports=t:e&&(e.scrypt&&(e._scrypt=e.scrypt),e.scrypt=t)}(this)}).call(this,e("timers").setImmediate)},{timers:45}],44:[function(e,t,r){(function(m,e){!function(r,n){"use strict";if(!r.setImmediate){var e,i,t,o,s,a=1,u={},l=!1,f=r.document,h=Object.getPrototypeOf&&Object.getPrototypeOf(r);h=h&&h.setTimeout?h:r,"[object process]"==={}.toString.call(r.process)?e=function(){var e=c(arguments);return m.nextTick(d(p,e)),e}:!function(){if(r.postMessage&&!r.importScripts){var e=!0,t=r.onmessage;return r.onmessage=function(){e=!1},r.postMessage("","*"),r.onmessage=t,e}}()?r.MessageChannel?((t=new MessageChannel).port1.onmessage=function(e){p(e.data)},e=function(){var e=c(arguments);return t.port2.postMessage(e),e}):f&&"onreadystatechange"in f.createElement("script")?(i=f.documentElement,e=function(){var e=c(arguments),t=f.createElement("script");return t.onreadystatechange=function(){p(e),t.onreadystatechange=null,i.removeChild(t),t=null},i.appendChild(t),e}):e=function(){var e=c(arguments);return setTimeout(d(p,e),0),e}:(o="setImmediate$"+Math.random()+"$",s=function(e){e.source===r&&"string"==typeof e.data&&0===e.data.indexOf(o)&&p(+e.data.slice(o.length))},r.addEventListener?r.addEventListener("message",s,!1):r.attachEvent("onmessage",s),e=function(){var e=c(arguments);return r.postMessage(o+e,"*"),e}),h.setImmediate=e,h.clearImmediate=v}function c(e){return u[a]=d.apply(n,e),a++}function d(e){var t=[].slice.call(arguments,1);return function(){"function"==typeof e?e.apply(n,t):new Function(""+e)()}}function p(e){if(l)setTimeout(d(p,e),0);else{var t=u[e];if(t){l=!0;try{t()}finally{v(e),l=!1}}}}function v(e){delete u[e]}}("undefined"==typeof self?void 0===e?this:e:self)}).call(this,e("_process"),"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{_process:42}],45:[function(e,t,r){(function(e){t.exports={setImmediate:e.setImmediate}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],46:[function(e,i,t){(function(e){var t;if(e.crypto&&crypto.getRandomValues){var r=new Uint8Array(16);t=function(){return crypto.getRandomValues(r),r}}if(!t){var n=new Array(16);t=function(){for(var e,t=0;t<16;t++)0==(3&t)&&(e=4294967296*Math.random()),n[t]=e>>>((3&t)<<3)&255;return n}}i.exports=t}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{}],47:[function(e,t,r){for(var s=e("./rng"),i=[],o={},n=0;n<256;n++)i[n]=(n+256).toString(16).substr(1),o[i[n]]=n;function d(e,t){var r=t||0,n=i;return n[e[r++]]+n[e[r++]]+n[e[r++]]+n[e[r++]]+"-"+n[e[r++]]+n[e[r++]]+"-"+n[e[r++]]+n[e[r++]]+"-"+n[e[r++]]+n[e[r++]]+"-"+n[e[r++]]+n[e[r++]]+n[e[r++]]+n[e[r++]]+n[e[r++]]+n[e[r++]]}var a=s(),p=[1|a[0],a[1],a[2],a[3],a[4],a[5]],v=16383&(a[6]<<8|a[7]),m=0,y=0;function u(e,t,r){var n=t&&r||0;"string"==typeof e&&(t="binary"==e?new Array(16):null,e=null);var i=(e=e||{}).random||(e.rng||s)();if(i[6]=15&i[6]|64,i[8]=63&i[8]|128,t)for(var o=0;o<16;o++)t[n+o]=i[o];return t||d(i)}var l=u;l.v1=function(e,t,r){var n=t&&r||0,i=t||[],o=void 0!==(e=e||{}).clockseq?e.clockseq:v,s=void 0!==e.msecs?e.msecs:(new Date).getTime(),a=void 0!==e.nsecs?e.nsecs:y+1,u=s-m+(a-y)/1e4;if(u<0&&void 0===e.clockseq&&(o=o+1&16383),(u<0||m<s)&&void 0===e.nsecs&&(a=0),1e4<=a)throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");m=s,v=o;var l=(1e4*(268435455&(s+=122192928e5))+(y=a))%4294967296;i[n++]=l>>>24&255,i[n++]=l>>>16&255,i[n++]=l>>>8&255,i[n++]=255&l;var f=s/4294967296*1e4&268435455;i[n++]=f>>>8&255,i[n++]=255&f,i[n++]=f>>>24&15|16,i[n++]=f>>>16&255,i[n++]=o>>>8|128,i[n++]=255&o;for(var h=e.node||p,c=0;c<6;c++)i[n+c]=h[c];return t||d(i)},l.v4=u,l.parse=function(e,t,r){var n=t&&r||0,i=0;for(t=t||[],e.toLowerCase().replace(/[0-9a-f]{2}/g,function(e){i<16&&(t[n+i++]=o[e])});i<16;)t[n+i++]=0;return t},l.unparse=d,t.exports=l},{"./rng":46}],48:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});try{t.exports.XMLHttpRequest=XMLHttpRequest}catch(e){console.log("Warning: XMLHttpRequest is not defined"),t.exports.XMLHttpRequest=null}},{}],49:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("../utils/properties"),i=function(){function e(){n.setType(this,"Provider")}return e.isProvider=function(e){return n.isType(e,"Provider")},e}();r.Provider=i},{"../utils/properties":72}],50:[function(e,t,r){"use strict";var n,o=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var s=e("../utils/address"),a=e("../utils/bignumber"),u=e("../utils/bytes"),l=e("../utils/hash"),f=e("../utils/networks"),h=e("../utils/properties"),c=e("../utils/rlp"),d=e("../utils/transaction"),p=e("../utils/utf8"),v=e("../utils/web"),m=i(e("../errors")),y=e("./abstract-provider");function g(e,t){var r={};for(var n in e)try{var i=e[n](t[n]);void 0!==i&&(r[n]=i)}catch(e){throw e.checkKey=n,e.checkValue=t[n],e}return r}function b(t,r){return function(e){return null==e?r:t(e)}}function w(r){return function(e){if(!Array.isArray(e))throw new Error("not an array");var t=[];return e.forEach(function(e){t.push(r(e))}),t}}function _(e,t){return"string"==typeof e&&(t||"0x"===e.substring(0,2)||(e="0x"+e),32===u.hexDataLength(e))?e.toLowerCase():(m.throwError("invalid hash",m.INVALID_ARGUMENT,{arg:"hash",value:e}),null)}function M(e){return a.bigNumberify(e).toNumber()}function A(e){if(!u.isHexString(e))throw new Error("invalid uint256");for(;e.length<66;)e="0x0"+e.substring(2);return e}function E(e){if(null==e)return"latest";if("earliest"===e)return"0x0";if("latest"===e||"pending"===e)return e;if("number"==typeof e)return u.hexStripZeros(u.hexlify(e));if(u.isHexString(e))return u.hexStripZeros(e);throw new Error("invalid blockTag")}var S={hash:_,blockHash:b(_,null),blockNumber:b(M,null),transactionIndex:b(M,null),confirmations:b(M,null),from:s.getAddress,gasPrice:a.bigNumberify,gasLimit:a.bigNumberify,to:b(s.getAddress,null),value:a.bigNumberify,nonce:M,data:u.hexlify,r:b(A),s:b(A),v:b(M),creates:b(s.getAddress,null),raw:b(u.hexlify)};function k(e){if(null!=e.gas&&null==e.gasLimit&&(e.gasLimit=e.gas),e.to&&a.bigNumberify(e.to).isZero()&&(e.to="0x0000000000000000000000000000000000000000"),null!=e.input&&null==e.data&&(e.data=e.input),null==e.to&&null==e.creates&&(e.creates=s.getContractAddress(e)),!e.raw&&e.v&&e.r&&e.s){var t=[u.stripZeros(u.hexlify(e.nonce)),u.stripZeros(u.hexlify(e.gasPrice)),u.stripZeros(u.hexlify(e.gasLimit)),e.to||"0x",u.stripZeros(u.hexlify(e.value||"0x")),u.hexlify(e.data||"0x"),u.stripZeros(u.hexlify(e.v||"0x")),u.stripZeros(u.hexlify(e.r)),u.stripZeros(u.hexlify(e.s))];e.raw=c.encode(t)}var r=g(S,e),n=e.networkId;return null!=e.chainId&&null==n&&null==r.v&&(n=e.chainId),u.isHexString(n)&&(n=a.bigNumberify(n).toNumber()),"number"!=typeof n&&null!=r.v&&((n=(r.v-35)/2)<0&&(n=0),n=parseInt(n)),"number"!=typeof n&&(n=0),r.networkId=n,r.blockHash&&"x"===r.blockHash.replace(/0/g,"")&&(r.blockHash=null),r}var N={hash:_,parentHash:_,number:M,timestamp:M,nonce:b(u.hexlify),difficulty:function(e){var t=a.bigNumberify(e);try{return t.toNumber()}catch(e){}return null},gasLimit:a.bigNumberify,gasUsed:a.bigNumberify,miner:s.getAddress,extraData:u.hexlify,transactions:b(w(_))},P=h.shallowCopy(N);function x(e,t){return null!=e.author&&null==e.miner&&(e.miner=e.author),g(t?P:N,e)}P.transactions=b(w(k));var I={from:b(s.getAddress),nonce:b(M),gasLimit:b(a.bigNumberify),gasPrice:b(a.bigNumberify),to:b(s.getAddress),value:b(a.bigNumberify),data:b(u.hexlify)};function T(e){return g(I,e)}var R={transactionLogIndex:b(M),transactionIndex:M,blockNumber:M,transactionHash:_,address:s.getAddress,topics:w(_),data:u.hexlify,logIndex:M,blockHash:_};var O={contractAddress:b(s.getAddress,null),transactionIndex:M,root:b(_),gasUsed:a.bigNumberify,logsBloom:b(u.hexlify),blockHash:_,transactionHash:_,logs:w(function(e){return g(R,e)}),blockNumber:M,confirmations:b(M,null),cumulativeGasUsed:a.bigNumberify,status:b(M)};var C={fromBlock:b(E,void 0),toBlock:b(E,void 0),address:b(s.getAddress,void 0),topics:b(function t(e){return Array.isArray(e)?e.forEach(function(e){t(e)}):null!=e&&_(e),e},void 0)};var B,D,L={blockNumber:b(M),blockHash:b(_),transactionIndex:M,removed:b(function(e){if("boolean"==typeof e)return e;if("string"==typeof e){if("true"===e)return!0;if("false"===e)return!1}throw new Error("invaid boolean - "+e)}),address:s.getAddress,data:(B=u.hexlify,D="0x",function(e){return e?B(e):D}),topics:w(_),transactionHash:_,logIndex:M};function U(e){return g(L,e)}function F(e){return e.map(function(e){return"string"==typeof e?e:Array.isArray(e)?(e.forEach(function(e){null!==e&&32!==u.hexDataLength(e)&&m.throwError("invalid topic",m.INVALID_ARGUMENT,{argument:"topic",value:e})}),e.join(",")):null===e?"":m.throwError("invalid topic value",m.INVALID_ARGUMENT,{argument:"topic",value:e})}).join("&")}function j(e){if("string"==typeof e){if(20===u.hexDataLength(e))return"address:"+s.getAddress(e);if(e=e.toLowerCase(),32===u.hexDataLength(e))return"tx:"+e;if(-1===e.indexOf(":"))return e}else{if(Array.isArray(e))return"filter::"+F(e);if(e&&"object"==typeof e)return"filter:"+(e.address||"")+":"+F(e.topics||[])}throw new Error("invalid event - "+e)}function G(){return(new Date).getTime()}var z=function(n){function i(e){var t=n.call(this)||this;if(m.checkNew(t,y.Provider),e instanceof Promise)h.defineReadOnly(t,"ready",e.then(function(e){return h.defineReadOnly(t,"_network",e),e}));else{var r=f.getNetwork(null==e?"homestead":e);r?(h.defineReadOnly(t,"_network",r),h.defineReadOnly(t,"ready",Promise.resolve(t._network))):m.throwError("invalid network",m.INVALID_ARGUMENT,{arg:"network",value:e})}return t._lastBlockNumber=-2,t._balances={},t._events=[],t._pollingInterval=4e3,t._emitted={block:-2},t._fastQueryDate=0,t}return o(i,n),i.prototype._doPoll=function(){var u=this;this.getBlockNumber().then(function(s){if(u._setFastBlockNumber(s),s!==u._lastBlockNumber){-2===u._emitted.block&&(u._emitted.block=s-1);for(var e=u._emitted.block+1;e<=s;e++)u.emit("block",e);u._emitted.block!==s&&(u._emitted.block=s,Object.keys(u._emitted).forEach(function(e){if("block"!==e){var t=u._emitted[e];"pending"!==t&&12<s-t&&delete u._emitted[e]}})),-2===u._lastBlockNumber&&(u._lastBlockNumber=s-1);var a={};return u._events.forEach(function(e){var t=e.tag.split(":");switch(t[0]){case"tx":var r=t[1];u.getTransactionReceipt(r).then(function(e){return e&&null!=e.blockNumber&&(u._emitted["t:"+r]=e.blockNumber,u.emit(r,e)),null}).catch(function(e){u.emit("error",e)});break;case"address":var n=t[1];u._balances[n]&&(a[n]=u._balances[n]),u.getBalance(n,"latest").then(function(e){var t=u._balances[n];if(!t||!e.eq(t))return u._balances[n]=e,u.emit(n,e),null}).catch(function(e){u.emit("error",e)});break;case"filter":var i=t[2].split(/&/g).map(function(e){var t=e.split(",");return 1===t.length?""===t[0]?null:e:t.map(function(e){return""===e?null:e})}),o={address:t[1],fromBlock:u._lastBlockNumber+1,toBlock:s,topics:i};o.address||delete o.address,u.getLogs(o).then(function(e){if(0!==e.length)return e.forEach(function(e){u._emitted["b:"+e.blockHash]=e.blockNumber,u._emitted["t:"+e.transactionHash]=e.blockNumber,u.emit(o,e)}),null}).catch(function(e){u.emit("error",e)})}}),u._lastBlockNumber=s,u._balances=a,null}}).catch(function(e){}),this.doPoll()},i.prototype.resetEventsBlock=function(e){this._lastBlockNumber=e-1,this.polling&&this._doPoll()},Object.defineProperty(i.prototype,"network",{get:function(){return this._network},enumerable:!0,configurable:!0}),i.prototype.getNetwork=function(){return this.ready},Object.defineProperty(i.prototype,"blockNumber",{get:function(){return this._fastBlockNumber},enumerable:!0,configurable:!0}),Object.defineProperty(i.prototype,"polling",{get:function(){return null!=this._poller},set:function(e){var t=this;setTimeout(function(){e&&!t._poller?t._poller=setInterval(t._doPoll.bind(t),t.pollingInterval):!e&&t._poller&&(clearInterval(t._poller),t._poller=null)},0)},enumerable:!0,configurable:!0}),Object.defineProperty(i.prototype,"pollingInterval",{get:function(){return this._pollingInterval},set:function(e){var t=this;if("number"!=typeof e||e<=0||parseInt(String(e))!=e)throw new Error("invalid polling interval");this._pollingInterval=e,this._poller&&(clearInterval(this._poller),this._poller=setInterval(function(){t._doPoll()},this._pollingInterval))},enumerable:!0,configurable:!0}),i.prototype._getFastBlockNumber=function(){var t=this,e=G();return e-this._fastQueryDate>2*this._pollingInterval&&(this._fastQueryDate=e,this._fastBlockNumberPromise=this.getBlockNumber().then(function(e){return(null==t._fastBlockNumber||e>t._fastBlockNumber)&&(t._fastBlockNumber=e),t._fastBlockNumber})),this._fastBlockNumberPromise},i.prototype._setFastBlockNumber=function(e){null!=this._fastBlockNumber&&e<this._fastBlockNumber||(this._fastQueryDate=G(),(null==this._fastBlockNumber||e>this._fastBlockNumber)&&(this._fastBlockNumber=e,this._fastBlockNumberPromise=Promise.resolve(e)))},i.prototype.waitForTransaction=function(e,t){var r=this;return null==t&&(t=1),v.poll(function(){return r.getTransactionReceipt(e).then(function(e){return 0===t?e:null==e||e.confirmations<t?void 0:e})},{onceBlock:this})},i.prototype.getBlockNumber=function(){var r=this;return this.ready.then(function(){return r.perform("getBlockNumber",{}).then(function(e){var t=parseInt(e);if(t!=e)throw new Error("invalid response - getBlockNumber");return r._setFastBlockNumber(t),t})})},i.prototype.getGasPrice=function(){var e=this;return this.ready.then(function(){return e.perform("getGasPrice",{}).then(function(e){return a.bigNumberify(e)})})},i.prototype.getBalance=function(e,t){var n=this;return this.ready.then(function(){return h.resolveProperties({addressOrName:e,blockTag:t}).then(function(e){var t=e.addressOrName,r=e.blockTag;return n.resolveName(t).then(function(e){var t={address:e,blockTag:E(r)};return n.perform("getBalance",t).then(function(e){return a.bigNumberify(e)})})})})},i.prototype.getTransactionCount=function(e,t){var n=this;return this.ready.then(function(){return h.resolveProperties({addressOrName:e,blockTag:t}).then(function(e){var t=e.addressOrName,r=e.blockTag;return n.resolveName(t).then(function(e){var t={address:e,blockTag:E(r)};return n.perform("getTransactionCount",t).then(function(e){return a.bigNumberify(e).toNumber()})})})})},i.prototype.getCode=function(e,t){var n=this;return this.ready.then(function(){return h.resolveProperties({addressOrName:e,blockTag:t}).then(function(e){var t=e.addressOrName,r=e.blockTag;return n.resolveName(t).then(function(e){var t={address:e,blockTag:E(r)};return n.perform("getCode",t).then(function(e){return u.hexlify(e)})})})})},i.prototype.getStorageAt=function(e,t,r){var i=this;return this.ready.then(function(){return h.resolveProperties({addressOrName:e,position:t,blockTag:r}).then(function(e){var t=e.addressOrName,r=e.position,n=e.blockTag;return i.resolveName(t).then(function(e){var t={address:e,blockTag:E(n),position:u.hexStripZeros(u.hexlify(r))};return i.perform("getStorageAt",t).then(function(e){return u.hexlify(e)})})})})},i.prototype.sendTransaction=function(e){var n=this;return this.ready.then(function(){return h.resolveProperties({signedTransaction:e}).then(function(e){var t=e.signedTransaction,r={signedTransaction:u.hexlify(t)};return n.perform("sendTransaction",r).then(function(e){return n._wrapTransaction(d.parse(t),e)},function(e){throw e.transaction=d.parse(t),e.transaction.hash&&(e.transactionHash=e.transaction.hash),e})})})},i.prototype._wrapTransaction=function(r,e){var n=this;if(null!=e&&32!==u.hexDataLength(e))throw new Error("invalid response - sendTransaction");var t=r;return null!=e&&r.hash!==e&&m.throwError("Transaction hash mismatch from Provider.sendTransaction.",m.UNKNOWN_ERROR,{expectedHash:r.hash,returnedHash:e}),t.wait=function(t){return 0!==t&&(n._emitted["t:"+r.hash]="pending"),n.waitForTransaction(r.hash,t).then(function(e){return null==e&&0===t?null:(n._emitted["t:"+r.hash]=e.blockNumber,0===e.status&&m.throwError("transaction failed",m.CALL_EXCEPTION,{transactionHash:r.hash,transaction:r}),e)})},t},i.prototype.call=function(e,t){var n=this,r=h.shallowCopy(e);return this.ready.then(function(){return h.resolveProperties({blockTag:t,tx:r}).then(function(e){var r=e.blockTag,t=e.tx;return n._resolveNames(t,["to","from"]).then(function(e){var t={blockTag:E(r),transaction:T(e)};return n.perform("call",t).then(function(e){return u.hexlify(e)})})})})},i.prototype.estimateGas=function(e){var r=this,t={to:e.to,from:e.from,data:e.data,gasPrice:e.gasPrice,value:e.value};return this.ready.then(function(){return h.resolveProperties(t).then(function(e){return r._resolveNames(e,["to","from"]).then(function(e){var t={transaction:T(e)};return r.perform("estimateGas",t).then(function(e){return a.bigNumberify(e)})})})})},i.prototype.getBlock=function(e,o){var s=this;return this.ready.then(function(){return h.resolveProperties({blockHashOrBlockTag:e}).then(function(e){var t=e.blockHashOrBlockTag;try{var r=u.hexlify(t);if(32===u.hexDataLength(r))return v.poll(function(){return s.perform("getBlock",{blockHash:r,includeTransactions:!!o}).then(function(e){return null==e?null==s._emitted["b:"+r]?null:void 0:x(e,o)})},{onceBlock:s})}catch(e){}try{var n=-128,i=E(t);return u.isHexString(i)&&(n=parseInt(i.substring(2),16)),v.poll(function(){return s.perform("getBlock",{blockTag:i,includeTransactions:!!o}).then(function(e){if(null==e){if(n<=s._emitted.block)return;return null}return x(e,o)})},{onceBlock:s})}catch(e){}throw new Error("invalid block hash or block tag")})})},i.prototype.getTransaction=function(e){var n=this;return this.ready.then(function(){return h.resolveProperties({transactionHash:e}).then(function(e){var t=e.transactionHash,r={transactionHash:_(t,!0)};return v.poll(function(){return n.perform("getTransaction",r).then(function(e){if(null==e)return null==n._emitted["t:"+t]?null:void 0;var r=i.checkTransactionResponse(e);if(null==r.blockNumber)r.confirmations=0;else if(null==r.confirmations)return n._getFastBlockNumber().then(function(e){var t=e-r.blockNumber+1;return t<=0&&(t=1),r.confirmations=t,n._wrapTransaction(r)});return n._wrapTransaction(r)})},{onceBlock:n})})})},i.prototype.getTransactionReceipt=function(e){var o=this;return this.ready.then(function(){return h.resolveProperties({transactionHash:e}).then(function(e){var i=e.transactionHash,t={transactionHash:_(i,!0)};return v.poll(function(){return o.perform("getTransactionReceipt",t).then(function(e){if(null==e)return null==o._emitted["t:"+i]?null:void 0;if(null!=e.blockHash){var t,r,n=((r=g(O,t=e)).logs.forEach(function(e,t){null==e.transactionLogIndex&&(e.transactionLogIndex=t)}),null!=t.status&&(r.byzantium=!0),r);if(null==n.blockNumber)n.confirmations=0;else if(null==n.confirmations)return o._getFastBlockNumber().then(function(e){var t=e-n.blockNumber+1;return t<=0&&(t=1),n.confirmations=t,n});return n}})},{onceBlock:o})})})},i.prototype.getLogs=function(e){var n=this;return this.ready.then(function(){return h.resolveProperties(e).then(function(e){return n._resolveNames(e,["address"]).then(function(e){var t,r={filter:(t=e,g(C,t))};return n.perform("getLogs",r).then(function(e){return w(U)(e)})})})})},i.prototype.getEtherPrice=function(){var e=this;return this.ready.then(function(){return e.perform("getEtherPrice",{}).then(function(e){return e})})},i.prototype._resolveNames=function(e,t){var r=[],n=h.shallowCopy(e);return t.forEach(function(t){null!=n[t]&&r.push(this.resolveName(n[t]).then(function(e){n[t]=e}))},this),Promise.all(r).then(function(){return n})},i.prototype._getResolver=function(n){var i=this;return this.getNetwork().then(function(e){e.ensAddress||m.throwError("network does support ENS",m.UNSUPPORTED_OPERATION,{operation:"ENS",network:e.name});var t="0x0178b8bf"+l.namehash(n).substring(2),r={to:e.ensAddress,data:t};return i.call(r).then(function(e){return 32!==u.hexDataLength(e)?null:s.getAddress(u.hexDataSlice(e,12))})})},i.prototype.resolveName=function(e){var t=this;if(e instanceof Promise)return e.then(function(e){return t.resolveName(e)});try{return Promise.resolve(s.getAddress(e))}catch(e){}var r=this,n=l.namehash(e);return this._getResolver(e).then(function(e){var t={to:e,data:"0x3b3b57de"+n.substring(2)};return r.call(t)}).then(function(e){if(32!==u.hexDataLength(e))return null;var t=s.getAddress(u.hexDataSlice(e,12));return"0x0000000000000000000000000000000000000000"===t?null:t})},i.prototype.lookupAddress=function(n){var t=this;if(n instanceof Promise)return n.then(function(e){return t.lookupAddress(e)});var e=(n=s.getAddress(n)).substring(2)+".addr.reverse",r=l.namehash(e),i=this;return this._getResolver(e).then(function(e){if(!e)return null;var t={to:e,data:"0x691f3431"+r.substring(2)};return i.call(t)}).then(function(e){if((e=e.substring(2)).length<64)return null;if((e=e.substring(64)).length<64)return null;var t=a.bigNumberify("0x"+e.substring(0,64)).toNumber();if(2*t>(e=e.substring(64)).length)return null;var r=p.toUtf8String("0x"+e.substring(0,2*t));return i.resolveName(r).then(function(e){return e!=n?null:r})})},i.checkTransactionResponse=function(e){return k(e)},i.prototype.doPoll=function(){},i.prototype.perform=function(e,t){return m.throwError(e+" not implemented",m.NOT_IMPLEMENTED,{operation:e}),null},i.prototype._startPending=function(){console.log("WARNING: this provider does not support pending events")},i.prototype._stopPending=function(){},i.prototype._addEventListener=function(e,t,r){this._events.push({tag:j(e),listener:t,once:r}),"pending"===e&&this._startPending(),this.polling=!0},i.prototype.on=function(e,t){return this._addEventListener(e,t,!1),this},i.prototype.once=function(e,t){return this._addEventListener(e,t,!0),this},i.prototype.addEventListener=function(e,t){return this.on(e,t)},i.prototype.emit=function(e){for(var t=this,r=[],n=1;n<arguments.length;n++)r[n-1]=arguments[n];var i=!1,o=j(e);return this._events=this._events.filter(function(e){return e.tag!==o||(setTimeout(function(){e.listener.apply(t,r)},0),i=!0,!e.once)}),0===this.listenerCount()&&(this.polling=!1),i},i.prototype.listenerCount=function(e){if(!e)return this._events.length;var t=j(e);return this._events.filter(function(e){return e.tag===t}).length},i.prototype.listeners=function(e){var t=j(e);return this._events.filter(function(e){return e.tag===t}).map(function(e){return e.listener})},i.prototype.removeAllListeners=function(e){var t=j(e);return this._events=this._events.filter(function(e){return e.tag!==t}),"pending"===e&&this._stopPending(),0===this._events.length&&(this.polling=!1),this},i.prototype.removeListener=function(e,t){var r=!1,n=j(e);return this._events=this._events.filter(function(e){return e.tag!==n||(!!r||(r=!1))}),"pending"===e&&0===this.listenerCount("pending")&&this._stopPending(),0===this.listenerCount()&&(this.polling=!1),this},i}(y.Provider);r.BaseProvider=z,h.defineReadOnly(y.Provider,"inherits",h.inheritable(y.Provider))},{"../errors":5,"../utils/address":59,"../utils/bignumber":61,"../utils/bytes":62,"../utils/hash":63,"../utils/networks":70,"../utils/properties":72,"../utils/rlp":74,"../utils/transaction":81,"../utils/utf8":83,"../utils/web":84,"./abstract-provider":49}],51:[function(e,t,r){"use strict";var n,i=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var s=e("./base-provider"),a=e("../utils/bytes"),u=e("../utils/properties"),f=e("../utils/web"),h=o(e("../errors"));function c(e){var t=[];for(var r in e)if(null!=e[r]){var n=a.hexlify(e[r]);({gasLimit:!0,gasPrice:!0,nonce:!0,value:!0})[r]&&(n=a.hexStripZeros(n)),t.push(r+"="+n)}return t.join("&")}function d(e){if(0==e.status&&("No records found"===e.message||"No transactions found"===e.message))return e.result;if(1!=e.status||"OK"!=e.message){var t=new Error("invalid response");throw t.result=JSON.stringify(e),t}return e.result}function p(e){if("2.0"!=e.jsonrpc)throw(t=new Error("invalid response")).result=JSON.stringify(e),t;if(e.error){var t=new Error(e.error.message||"unknown error");throw e.error.code&&(t.code=e.error.code),e.error.data&&(t.data=e.error.data),t}return e.result}function v(e){if("pending"===e)throw new Error("pending not supported");return"latest"===e?e:parseInt(e.substring(2),16)}var l=function(l){function o(e,t){var r=l.call(this,e)||this;h.checkNew(r,o);var n="invalid";r.network&&(n=r.network.name);var i=null;switch(n){case"homestead":i="https://api.etherscan.io";break;case"ropsten":i="https://api-ropsten.etherscan.io";break;case"rinkeby":i="https://api-rinkeby.etherscan.io";break;case"kovan":i="https://api-kovan.etherscan.io";break;default:throw new Error("unsupported network")}return u.defineReadOnly(r,"baseUrl",i),u.defineReadOnly(r,"apiKey",t),r}return i(o,l),o.prototype.perform=function(e,t){var r=this,n=this.baseUrl,i="";this.apiKey&&(i+="&apikey="+this.apiKey);var o=function(t,e){return f.fetchJson(t,null,e||p).then(function(e){return r.emit("debug",{action:"perform",request:t,response:e,provider:r}),e})};switch(e){case"getBlockNumber":return o(n+="/api?module=proxy&action=eth_blockNumber"+i);case"getGasPrice":return o(n+="/api?module=proxy&action=eth_gasPrice"+i);case"getBalance":return n+="/api?module=account&action=balance&address="+t.address,o(n+="&tag="+t.blockTag+i,d);case"getTransactionCount":return n+="/api?module=proxy&action=eth_getTransactionCount&address="+t.address,o(n+="&tag="+t.blockTag+i);case"getCode":return n+="/api?module=proxy&action=eth_getCode&address="+t.address,o(n+="&tag="+t.blockTag+i,p);case"getStorageAt":return n+="/api?module=proxy&action=eth_getStorageAt&address="+t.address,n+="&position="+t.position,o(n+="&tag="+t.blockTag+i,p);case"sendTransaction":return n+="/api?module=proxy&action=eth_sendRawTransaction&hex="+t.signedTransaction,o(n+=i).catch(function(e){throw e.responseText&&(0<=e.responseText.toLowerCase().indexOf("insufficient funds")&&h.throwError("insufficient funds",h.INSUFFICIENT_FUNDS,{}),0<=e.responseText.indexOf("same hash was already imported")&&h.throwError("nonce has already been used",h.NONCE_EXPIRED,{}),0<=e.responseText.indexOf("another transaction with same nonce")&&h.throwError("replacement fee too low",h.REPLACEMENT_UNDERPRICED,{})),e});case"getBlock":if(t.blockTag)return n+="/api?module=proxy&action=eth_getBlockByNumber&tag="+t.blockTag,t.includeTransactions?n+="&boolean=true":n+="&boolean=false",o(n+=i);throw new Error("getBlock by blockHash not implmeneted");case"getTransaction":return n+="/api?module=proxy&action=eth_getTransactionByHash&txhash="+t.transactionHash,o(n+=i);case"getTransactionReceipt":return n+="/api?module=proxy&action=eth_getTransactionReceipt&txhash="+t.transactionHash,o(n+=i);case"call":if((s=c(t.transaction))&&(s="&"+s),n+="/api?module=proxy&action=eth_call"+s,"latest"!==t.blockTag)throw new Error("EtherscanProvider does not support blockTag for call");return o(n+=i);case"estimateGas":var s;return(s=c(t.transaction))&&(s="&"+s),n+="/api?module=proxy&action=eth_estimateGas&"+s,o(n+=i);case"getLogs":n+="/api?module=logs&action=getLogs";try{if(t.filter.fromBlock&&(n+="&fromBlock="+v(t.filter.fromBlock)),t.filter.toBlock&&(n+="&toBlock="+v(t.filter.toBlock)),t.filter.address&&(n+="&address="+t.filter.address),t.filter.topics&&0<t.filter.topics.length){if(1<t.filter.topics.length)throw new Error("unsupported topic format");var a=t.filter.topics[0];if("string"!=typeof a||66!==a.length)throw new Error("unsupported topic0 format");n+="&topic0="+a}}catch(e){return Promise.reject(e)}var u=this;return o(n+=i,d).then(function(e){var r={},n=Promise.resolve();return e.forEach(function(t){n=n.then(function(){return null!=t.blockHash?null:(t.blockHash=r[t.transactionHash],null==t.blockHash?u.getTransaction(t.transactionHash).then(function(e){return r[t.transactionHash]=e.blockHash,t.blockHash=e.blockHash,null}):null)})}),n.then(function(){return e})});case"getEtherPrice":return"homestead"!==this.network.name?Promise.resolve(0):(n+="/api?module=stats&action=ethprice",o(n+=i,d).then(function(e){return parseFloat(e.ethusd)}))}return l.prototype.perform.call(this,e,t)},o.prototype.getHistory=function(e,t,r){var n=this,i=this.baseUrl,o="";return this.apiKey&&(o+="&apikey="+this.apiKey),null==t&&(t=0),null==r&&(r=99999999),this.resolveName(e).then(function(e){return i+="/api?module=account&action=txlist&address="+e,i+="&startblock="+t,i+="&endblock="+r,i+="&sort=asc"+o,f.fetchJson(i,null,d).then(function(e){n.emit("debug",{action:"getHistory",request:i,response:e,provider:n});var r=[];return e.forEach(function(t){["contractAddress","to"].forEach(function(e){""==t[e]&&delete t[e]}),null==t.creates&&null!=t.contractAddress&&(t.creates=t.contractAddress);var e=s.BaseProvider.checkTransactionResponse(t);t.timeStamp&&(e.timestamp=parseInt(t.timeStamp)),r.push(e)}),r})})},o}(s.BaseProvider);r.EtherscanProvider=l},{"../errors":5,"../utils/bytes":62,"../utils/properties":72,"../utils/web":84,"./base-provider":50}],52:[function(e,t,r){"use strict";var n,o=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var s=e("./base-provider"),a=i(e("../errors"));function u(t){var r=!0,n=null;return t.forEach(function(e){null!=e?null!=n?n.name===e.name&&n.chainId===e.chainId&&(n.ensAddress===e.ensAddress||null==n.ensAddress&&null==e.ensAddress)||a.throwError("provider mismatch",a.INVALID_ARGUMENT,{arg:"networks",value:t}):n=e:r=!1}),r}var l=function(n){function i(e){var t=this;if(0===e.length)throw new Error("no providers");if(u(e.map(function(e){return e.network})))t=n.call(this,e[0].network)||this;else{var r=Promise.all(e.map(function(e){return e.getNetwork()})).then(function(e){return u(e)||a.throwError("getNetwork returned null",a.UNKNOWN_ERROR,{}),e[0]});t=n.call(this,r)||this}return a.checkNew(t,i),t._providers=e.slice(0),t}return o(i,n),Object.defineProperty(i.prototype,"providers",{get:function(){return this._providers.slice(0)},enumerable:!0,configurable:!0}),i.prototype.perform=function(i,o){var s=this.providers;return new Promise(function(r,e){var n=null;!function t(){s.length?s.shift().perform(i,o).then(function(e){return r(e)}).catch(function(e){n||(n=e),setTimeout(t,0)}):e(n)}()})},i}(s.BaseProvider);r.FallbackProvider=l},{"../errors":5,"./base-provider":50}],53:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./abstract-provider");r.Provider=n.Provider;var i=e("./base-provider");r.BaseProvider=i.BaseProvider;var o=e("./etherscan-provider");r.EtherscanProvider=o.EtherscanProvider;var s=e("./fallback-provider");r.FallbackProvider=s.FallbackProvider;var a=e("./ipc-provider");r.IpcProvider=a.IpcProvider;var u=e("./infura-provider");r.InfuraProvider=u.InfuraProvider;var l=e("./json-rpc-provider");r.JsonRpcProvider=l.JsonRpcProvider,r.JsonRpcSigner=l.JsonRpcSigner;var f=e("./web3-provider");r.Web3Provider=f.Web3Provider},{"./abstract-provider":49,"./base-provider":50,"./etherscan-provider":51,"./fallback-provider":52,"./infura-provider":54,"./ipc-provider":55,"./json-rpc-provider":56,"./web3-provider":57}],54:[function(e,t,r){"use strict";var n,s=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var o=e("./json-rpc-provider"),a=e("../utils/networks"),u=e("../utils/properties"),l=i(e("../errors")),f=function(i){function o(e,t){var r,n=null;switch((e=a.getNetwork(null==e?"homestead":e)).name){case"homestead":n="mainnet.infura.io";break;case"ropsten":n="ropsten.infura.io";break;case"rinkeby":n="rinkeby.infura.io";break;case"kovan":n="kovan.infura.io";break;default:throw new Error("unsupported network")}return r=i.call(this,"https://"+n+"/"+(t||""),e)||this,l.checkNew(r,o),u.defineReadOnly(r,"apiAccessToken",t||null),r}return s(o,i),o.prototype._startPending=function(){console.log("WARNING: INFURA does not support pending filters")},o.prototype.getSigner=function(e){return l.throwError("INFURA does not support signing",l.UNSUPPORTED_OPERATION,{operation:"getSigner"}),null},o.prototype.listAccounts=function(){return Promise.resolve([])},o}(o.JsonRpcProvider);r.InfuraProvider=f},{"../errors":5,"../utils/networks":70,"../utils/properties":72,"./json-rpc-provider":56}],55:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0})},{}],56:[function(e,t,r){"use strict";var n,s=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var o=e("./base-provider"),a=e("../abstract-signer"),u=i(e("../errors")),l=e("../utils/address"),f=e("../utils/bytes"),h=e("../utils/networks"),c=e("../utils/properties"),d=e("../utils/transaction"),p=e("../utils/utf8"),v=e("../utils/web");function m(e){if(e.error){var t=new Error(e.error.message);throw t.code=e.error.code,t.data=e.error.data,t}return e.result}function y(e){return e?e.toLowerCase():e}var g={},b=function(i){function o(e,t,r){var n=i.call(this)||this;if(u.checkNew(n,o),e!==g)throw new Error("do not call the JsonRpcSigner constructor directly; use provider.getSigner");return c.defineReadOnly(n,"provider",t),r?"string"==typeof r?c.defineReadOnly(n,"_address",l.getAddress(r)):"number"==typeof r?c.defineReadOnly(n,"_index",r):u.throwError("invalid address or index",u.INVALID_ARGUMENT,{argument:"addressOrIndex",value:r}):c.defineReadOnly(n,"_index",0),n}return s(o,i),o.prototype.getAddress=function(){var t=this;return this._address?Promise.resolve(this._address):this.provider.send("eth_accounts",[]).then(function(e){return e.length<=t._index&&u.throwError("unknown account #"+t._index,u.UNSUPPORTED_OPERATION,{operation:"getAddress"}),t._address=l.getAddress(e[t._index]),t._address})},o.prototype.getBalance=function(e){return this.provider.getBalance(this.getAddress(),e)},o.prototype.getTransactionCount=function(e){return this.provider.getTransactionCount(this.getAddress(),e)},o.prototype.sendTransaction=function(e){var r=this,n=null,t=this.getAddress().then(function(e){return e&&(n=e.toLowerCase()),n});return d.populateTransaction(e,this.provider,t).then(function(t){var e=_.hexlifyTransaction(t);return e.from=n,r.provider.send("eth_sendTransaction",[e]).then(function(t){return v.poll(function(){return r.provider.getTransaction(t).then(function(e){if(null!==e)return r.provider._wrapTransaction(e,t)})},{onceBlock:r.provider}).catch(function(e){throw e.transactionHash=t,e})},function(e){throw e.responseText&&(0<=e.responseText.indexOf("insufficient funds")&&u.throwError("insufficient funds",u.INSUFFICIENT_FUNDS,{transaction:t}),0<=e.responseText.indexOf("nonce too low")&&u.throwError("nonce has already been used",u.NONCE_EXPIRED,{transaction:t}),0<=e.responseText.indexOf("replacement transaction underpriced")&&u.throwError("replacement fee too low",u.REPLACEMENT_UNDERPRICED,{transaction:t})),e})})},o.prototype.signMessage=function(e){var t=this,r="string"==typeof e?p.toUtf8Bytes(e):e;return this.getAddress().then(function(e){return t.provider.send("eth_sign",[e.toLowerCase(),f.hexlify(r)])})},o.prototype.unlock=function(t){var r=this.provider;return this.getAddress().then(function(e){return r.send("personal_unlockAccount",[e.toLowerCase(),t,null])})},o}(a.Signer);r.JsonRpcSigner=b;var w={chainId:!0,data:!0,gasLimit:!0,gasPrice:!0,nonce:!0,to:!0,value:!0},_=function(i){function o(e,t){var n=this;if("string"==typeof e&&null===t&&h.getNetwork(e)&&(t=e,e=null),t)n=i.call(this,t)||this;else{var r=new Promise(function(t,r){setTimeout(function(){n.send("net_version",[]).then(function(e){return t(h.getNetwork(parseInt(e)))}).catch(function(e){r(e)})})});n=i.call(this,r)||this}return u.checkNew(n,o),e||(e="http://localhost:8545"),n.connection="string"==typeof e?{url:e}:e,n}return s(o,i),o.prototype.getSigner=function(e){return new b(g,this,e)},o.prototype.listAccounts=function(){return this.send("eth_accounts",[]).then(function(e){return e.map(function(e){return l.getAddress(e)})})},o.prototype.send=function(e,t){var r=this,n={method:e,params:t,id:42,jsonrpc:"2.0"};return v.fetchJson(this.connection,JSON.stringify(n),m).then(function(e){return r.emit("debug",{action:"send",request:n,response:e,provider:r}),e})},o.prototype.perform=function(e,t){switch(e){case"getBlockNumber":return this.send("eth_blockNumber",[]);case"getGasPrice":return this.send("eth_gasPrice",[]);case"getBalance":return this.send("eth_getBalance",[y(t.address),t.blockTag]);case"getTransactionCount":return this.send("eth_getTransactionCount",[y(t.address),t.blockTag]);case"getCode":return this.send("eth_getCode",[y(t.address),t.blockTag]);case"getStorageAt":return this.send("eth_getStorageAt",[y(t.address),t.position,t.blockTag]);case"sendTransaction":return this.send("eth_sendRawTransaction",[t.signedTransaction]).catch(function(e){throw e.responseText&&(0<e.responseText.indexOf("insufficient funds")&&u.throwError("insufficient funds",u.INSUFFICIENT_FUNDS,{}),0<e.responseText.indexOf("nonce too low")&&u.throwError("nonce has already been used",u.NONCE_EXPIRED,{}),0<e.responseText.indexOf("replacement transaction underpriced")&&u.throwError("replacement fee too low",u.REPLACEMENT_UNDERPRICED,{})),e});case"getBlock":return t.blockTag?this.send("eth_getBlockByNumber",[t.blockTag,!!t.includeTransactions]):t.blockHash?this.send("eth_getBlockByHash",[t.blockHash,!!t.includeTransactions]):Promise.reject(new Error("invalid block tag or block hash"));case"getTransaction":return this.send("eth_getTransactionByHash",[t.transactionHash]);case"getTransactionReceipt":return this.send("eth_getTransactionReceipt",[t.transactionHash]);case"call":return this.send("eth_call",[o.hexlifyTransaction(t.transaction,{from:!0}),t.blockTag]);case"estimateGas":return this.send("eth_estimateGas",[o.hexlifyTransaction(t.transaction,{from:!0})]);case"getLogs":return t.filter&&null!=t.filter.address&&(t.filter.address=y(t.filter.address)),this.send("eth_getLogs",[t.filter])}return u.throwError(e+" not implemented",u.NOT_IMPLEMENTED,{operation:e}),null},o.prototype._startPending=function(){if(null==this._pendingFilter){var r=this,n=this.send("eth_newPendingTransactionFilter",[]);(this._pendingFilter=n).then(function(t){return function e(){r.send("eth_getFilterChanges",[t]).then(function(e){if(r._pendingFilter!=n)return null;var t=Promise.resolve();return e.forEach(function(e){r._emitted["t:"+e.toLowerCase()]="pending",t=t.then(function(){return r.getTransaction(e).then(function(e){return r.emit("pending",e),null})})}),t.then(function(){return t=1e3,new Promise(function(e){setTimeout(function(){e()},t)});var t})}).then(function(){if(r._pendingFilter==n)return setTimeout(function(){e()},0),null;r.send("eth_uninstallFilter",[t])}).catch(function(e){})}(),t}).catch(function(e){})}},o.prototype._stopPending=function(){this._pendingFilter=null},o.hexlifyTransaction=function(r,e){var t=c.shallowCopy(w);if(e)for(var n in e)e[n]&&(t[n]=!0);c.checkProperties(r,t);var i={};return["gasLimit","gasPrice","nonce","value"].forEach(function(e){if(null!=r[e]){var t=f.hexStripZeros(f.hexlify(r[e]));"gasLimit"===e&&(e="gas"),i[e]=t}}),["from","to","data"].forEach(function(e){null!=r[e]&&(i[e]=f.hexlify(r[e]))}),i},o}(o.BaseProvider);r.JsonRpcProvider=_},{"../abstract-signer":2,"../errors":5,"../utils/address":59,"../utils/bytes":62,"../utils/networks":70,"../utils/properties":72,"../utils/transaction":81,"../utils/utf8":83,"../utils/web":84,"./base-provider":50}],57:[function(e,t,r){"use strict";var n,o=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var s=e("./json-rpc-provider"),a=e("../utils/properties"),u=i(e("../errors")),l=function(n){function i(e,t){var r=n.call(this,e.host||e.path||"",t)||this;return u.checkNew(r,i),e&&(e.sendAsync?r._sendAsync=e.sendAsync.bind(e):e.send&&(r._sendAsync=e.send.bind(e))),e&&r._sendAsync||u.throwError("invalid web3Provider",u.INVALID_ARGUMENT,{arg:"web3Provider",value:e}),a.defineReadOnly(r,"_web3Provider",e),r}return o(i,n),i.prototype.send=function(t,i){var o=this;return"eth_sign"==t&&this._web3Provider.isMetaMask&&(t="personal_sign",i=[i[1],i[0]]),new Promise(function(r,n){var e={method:t,params:i,id:42,jsonrpc:"2.0"};o._sendAsync(e,function(e,t){if(e)n(e);else{if(t.error)return(e=new Error(t.error.message)).code=t.error.code,e.data=t.error.data,void n(e);r(t.result)}})})},i}(s.JsonRpcProvider);r.Web3Provider=l},{"../errors":5,"../utils/properties":72,"./json-rpc-provider":56}],58:[function(e,t,r){"use strict";var n,i=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var a=e("../constants"),l=o(e("../errors")),s=e("./address"),u=e("./bignumber"),f=e("./bytes"),h=e("./utf8"),c=e("./properties"),d=new RegExp(/^bytes([0-9]*)$/),p=new RegExp(/^(u?int)([0-9]*)$/),v=new RegExp(/^(.*)\[([0-9]*)\]$/);r.defaultCoerceFunc=function(e,t){var r=e.match(p);return r&&parseInt(r[2])<=48?t.toNumber():t};var m=new RegExp("^([^)(]*)\\((.*)\\)([^)(]*)$"),y=new RegExp("^[A-Za-z_][A-Za-z0-9_]*$");function g(e){return e.match(/^uint($|[^1-9])/)?e="uint256"+e.substring(4):e.match(/^int($|[^1-9])/)&&(e="int256"+e.substring(3)),e}function b(t,e){function r(e){throw new Error('unexpected character "'+t[e]+'" at position '+e+' in "'+t+'"')}for(var n={type:"",name:"",state:{allowType:!0}},i=n,o=0;o<t.length;o++){var s=t[o];switch(s){case"(":i.state.allowParams||r(o),i.state.allowType=!1,i.type=g(i.type),i.components=[{type:"",name:"",parent:i,state:{allowType:!0}}],i=i.components[0];break;case")":delete i.state,e&&"indexed"===i.name&&(i.indexed=!0,i.name=""),i.type=g(i.type);var a=i;(i=i.parent)||r(o),delete a.parent,i.state.allowParams=!1,i.state.allowName=!0,i.state.allowArray=!0;break;case",":delete i.state,e&&"indexed"===i.name&&(i.indexed=!0,i.name=""),i.type=g(i.type);var u={type:"",name:"",parent:i.parent,state:{allowType:!0}};i.parent.components.push(u),delete i.parent,i=u;break;case" ":i.state.allowType&&""!==i.type&&(i.type=g(i.type),delete i.state.allowType,i.state.allowName=!0,i.state.allowParams=!0),i.state.allowName&&""!==i.name&&(e&&"indexed"===i.name?(i.indexed=!0,i.name=""):i.state.allowName=!1);break;case"[":i.state.allowArray||r(o),i.type+=s,i.state.allowArray=!1,i.state.allowName=!1,i.state.readArray=!0;break;case"]":i.state.readArray||r(o),i.type+=s,i.state.readArray=!1,i.state.allowArray=!0,i.state.allowName=!0;break;default:i.state.allowType?(i.type+=s,i.state.allowParams=!0,i.state.allowArray=!0):i.state.allowName?(i.name+=s,delete i.state.allowArray):i.state.readArray?i.type+=s:r(o)}}if(i.parent)throw new Error("unexpected eof");return delete n.state,e&&"indexed"===i.name&&(i.indexed=!0,i.name=""),n.type=g(n.type),n}function w(e){return j(r.defaultCoerceFunc,e).type}r.parseParamType=function(e){return b(e,!0)},r.formatParamType=w,r.formatSignature=function(e){return e.name+"("+e.inputs.map(function(e){return w(e)}).join(",")+")"},r.parseSignature=function(e){if("string"==typeof e)return"event "===(e=(e=e.replace(/\(/g," (").replace(/\)/g,") ").replace(/\s+/g," ")).trim()).substring(0,6)?function(e){var t={anonymous:!1,inputs:[],name:"",type:"event"},r=e.match(m);if(!r)throw new Error("invalid event: "+e);if(t.name=r[1].trim(),U(r[2]).forEach(function(e){(e=b(e,!0)).indexed=!!e.indexed,t.inputs.push(e)}),r[3].split(" ").forEach(function(e){switch(e){case"anonymous":t.anonymous=!0;break;case"":break;default:console.log("unknown modifier: "+e)}}),t.name&&!t.name.match(y))throw new Error('invalid identifier: "'+t.name+'"');return t}(e.substring(6).trim()):("function "===e.substring(0,9)&&(e=e.substring(9)),function(e){var t={constant:!1,gas:null,inputs:[],name:"",outputs:[],payable:!1,stateMutability:null,type:"function"},r=e.split("@");if(1!==r.length){if(2<r.length)throw new Error("invalid signature");if(!r[1].match(/^[0-9]+$/))throw new Error("invalid signature gas");t.gas=u.bigNumberify(r[1]),e=r[0]}var n=(r=e.split(" returns "))[0].match(m);if(!n)throw new Error("invalid signature");if(t.name=n[1].trim(),!t.name.match(y))throw new Error('invalid identifier: "'+n[1]+'"');if(U(n[2]).forEach(function(e){t.inputs.push(b(e))}),n[3].split(" ").forEach(function(e){switch(e){case"constant":t.constant=!0;break;case"payable":t.payable=!0,t.stateMutability="payable";break;case"pure":t.constant=!0,t.stateMutability="pure";break;case"view":t.constant=!0,t.stateMutability="view";break;case"external":case"public":case"":break;default:console.log("unknown modifier: "+e)}}),1<r.length){var i=r[1].match(m);if(""!=i[1].trim()||""!=i[3].trim())throw new Error("unexpected tokens");U(i[2]).forEach(function(e){t.outputs.push(b(e))})}if("constructor"===t.name){if(t.type="constructor",t.outputs.length)throw new Error("constructor may not have outputs");delete t.name,delete t.outputs}return t}(e.trim()));throw new Error("unknown signature")};var _=function(e,t,r,n,i){this.coerceFunc=e,this.name=t,this.type=r,this.localName=n,this.dynamic=i},M=function(r){function e(e){var t=r.call(this,e.coerceFunc,e.name,e.type,void 0,e.dynamic)||this;return c.defineReadOnly(t,"coder",e),t}return i(e,r),e.prototype.encode=function(e){return this.coder.encode(e)},e.prototype.decode=function(e,t){return this.coder.decode(e,t)},e}(_),A=function(r){function e(e,t){return r.call(this,e,"null","",t,!1)||this}return i(e,r),e.prototype.encode=function(e){return f.arrayify([])},e.prototype.decode=function(e,t){if(t>e.length)throw new Error("invalid null");return{consumed:0,value:this.coerceFunc("null",void 0)}},e}(_),E=function(s){function e(e,t,r,n){var i=this,o=(r?"int":"uint")+8*t;return(i=s.call(this,e,o,o,n,!1)||this).size=t,i.signed=r,i}return i(e,s),e.prototype.encode=function(t){try{var e=u.bigNumberify(t);if(this.signed){var r=a.MaxUint256.maskn(8*this.size-1);if(e.gt(r))throw new Error("out-of-bounds");if(r=r.add(a.One).mul(a.NegativeOne),e.lt(r))throw new Error("out-of-bounds")}else if(e.lt(a.Zero)||e.gt(a.MaxUint256.maskn(8*this.size)))throw new Error("out-of-bounds");return e=e.toTwos(8*this.size).maskn(8*this.size),this.signed&&(e=e.fromTwos(8*this.size).toTwos(256)),f.padZeros(f.arrayify(e),32)}catch(e){l.throwError("invalid number value",l.INVALID_ARGUMENT,{arg:this.localName,coderType:this.name,value:t})}return null},e.prototype.decode=function(e,t){e.length<t+32&&l.throwError("insufficient data for "+this.name+" type",l.INVALID_ARGUMENT,{arg:this.localName,coderType:this.name,value:f.hexlify(e.slice(t,t+32))});var r=32-this.size,n=u.bigNumberify(e.slice(t+r,t+32));return n=this.signed?n.fromTwos(8*this.size):n.maskn(8*this.size),{consumed:32,value:this.coerceFunc(this.name,n)}},e}(_),S=new E(function(e,t){return t},32,!1,"none"),k=function(r){function e(e,t){return r.call(this,e,"bool","bool",t,!1)||this}return i(e,r),e.prototype.encode=function(e){return S.encode(e?1:0)},e.prototype.decode=function(e,t){try{var r=S.decode(e,t)}catch(e){throw"insufficient data for uint256 type"===e.reason&&l.throwError("insufficient data for boolean type",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"boolean",value:e.value}),e}return{consumed:r.consumed,value:this.coerceFunc("bool",!r.value.isZero())}},e}(_),N=function(o){function e(e,t,r){var n=this,i="bytes"+t;return(n=o.call(this,e,i,i,r,!1)||this).length=t,n}return i(e,o),e.prototype.encode=function(t){var e=new Uint8Array(32);try{var r=f.arrayify(t);if(r.length!==this.length)throw new Error("incorrect data length");e.set(r)}catch(e){l.throwError("invalid "+this.name+" value",l.INVALID_ARGUMENT,{arg:this.localName,coderType:this.name,value:e.value||t})}return e},e.prototype.decode=function(e,t){return e.length<t+32&&l.throwError("insufficient data for "+name+" type",l.INVALID_ARGUMENT,{arg:this.localName,coderType:this.name,value:f.hexlify(e.slice(t,t+32))}),{consumed:32,value:this.coerceFunc(this.name,f.hexlify(e.slice(t,t+this.length)))}},e}(_),P=function(r){function e(e,t){return r.call(this,e,"address","address",t,!1)||this}return i(e,r),e.prototype.encode=function(t){var e=new Uint8Array(32);try{e.set(f.arrayify(s.getAddress(t)),12)}catch(e){l.throwError("invalid address",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"address",value:t})}return e},e.prototype.decode=function(e,t){return e.length<t+32&&l.throwError("insufficuent data for address type",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"address",value:f.hexlify(e.slice(t,t+32))}),{consumed:32,value:this.coerceFunc("address",s.getAddress(f.hexlify(e.slice(t+12,t+32))))}},e}(_);function x(e){var t=32*Math.ceil(e.length/32),r=new Uint8Array(t-e.length);return f.concat([S.encode(e.length),e,r])}function I(e,t,r){e.length<t+32&&l.throwError("insufficient data for dynamicBytes length",l.INVALID_ARGUMENT,{arg:r,coderType:"dynamicBytes",value:f.hexlify(e.slice(t,t+32))});var n=S.decode(e,t).value;try{n=n.toNumber()}catch(e){l.throwError("dynamic bytes count too large",l.INVALID_ARGUMENT,{arg:r,coderType:"dynamicBytes",value:n.toString()})}return e.length<t+32+n&&l.throwError("insufficient data for dynamicBytes type",l.INVALID_ARGUMENT,{arg:r,coderType:"dynamicBytes",value:f.hexlify(e.slice(t,t+32+n))}),{consumed:32+32*Math.ceil(n/32),value:e.slice(t+32,t+32+n)}}var T=function(r){function e(e,t){return r.call(this,e,"bytes","bytes",t,!0)||this}return i(e,r),e.prototype.encode=function(e){try{return x(f.arrayify(e))}catch(e){l.throwError("invalid bytes value",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"bytes",value:e.value})}return null},e.prototype.decode=function(e,t){var r=I(e,t,this.localName);return r.value=this.coerceFunc("bytes",f.hexlify(r.value)),r},e}(_),R=function(r){function e(e,t){return r.call(this,e,"string","string",t,!0)||this}return i(e,r),e.prototype.encode=function(e){return"string"!=typeof e&&l.throwError("invalid string value",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"string",value:e}),x(h.toUtf8Bytes(e))},e.prototype.decode=function(e,t){var r=I(e,t,this.localName);return r.value=this.coerceFunc("string",h.toUtf8String(r.value)),r},e}(_);function O(e){return 32*Math.ceil(e/32)}function C(e,r){if(Array.isArray(r));else if(r&&"object"==typeof r){var t=[];e.forEach(function(e){t.push(r[e.localName])}),r=t}else l.throwError("invalid tuple value",l.INVALID_ARGUMENT,{coderType:"tuple",value:r});e.length!==r.length&&l.throwError("types/value length mismatch",l.INVALID_ARGUMENT,{coderType:"tuple",value:r});var n=[];e.forEach(function(e,t){n.push({dynamic:e.dynamic,value:e.encode(r[t])})});var i=0,o=0;n.forEach(function(e){e.dynamic?(i+=32,o+=O(e.value.length)):i+=O(e.value.length)});var s=0,a=i,u=new Uint8Array(i+o);return n.forEach(function(e){e.dynamic?(u.set(S.encode(a),s),s+=32,u.set(e.value,a),a+=O(e.value.length)):(u.set(e.value,s),s+=O(e.value.length))}),u}function B(e,n,i){var o=i,s=0,a=[];return e.forEach(function(e){if(e.dynamic){var t=S.decode(n,i);(r=e.decode(n,o+t.value.toNumber())).consumed=t.consumed}else var r=e.decode(n,i);null!=r.value&&a.push(r.value),i+=r.consumed,s+=r.consumed}),e.forEach(function(e,t){var r=e.localName;r&&("length"===r&&(r="_length"),null==a[r]&&(a[r]=a[t]))}),{value:a,consumed:s}}var D=function(a){function e(e,t,r,n){var i=this,o=t.type+"["+(0<=r?r:"")+"]",s=-1===r||t.dynamic;return(i=a.call(this,e,"array",o,n,s)||this).coder=t,i.length=r,i}return i(e,a),e.prototype.encode=function(e){Array.isArray(e)||l.throwError("expected array value",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"array",value:e});var t=this.length,r=new Uint8Array(0);-1===t&&(t=e.length,r=S.encode(t)),l.checkArgumentCount(t,e.length," in coder array"+(this.localName?" "+this.localName:""));for(var n=[],i=0;i<e.length;i++)n.push(this.coder);return f.concat([r,C(n,e)])},e.prototype.decode=function(e,t){var r=0,n=this.length;if(-1===n){try{var i=S.decode(e,t)}catch(e){l.throwError("insufficient data for dynamic array length",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"array",value:e.value})}try{n=i.value.toNumber()}catch(e){l.throwError("array count too large",l.INVALID_ARGUMENT,{arg:this.localName,coderType:"array",value:i.value.toString()})}r+=i.consumed,t+=i.consumed}for(var o=[],s=0;s<n;s++)o.push(new M(this.coder));var a=B(o,e,t);return a.consumed+=r,a.value=this.coerceFunc(this.type,a.value),a},e}(_),L=function(a){function e(e,t,r){var n=this,i=!1,o=[];t.forEach(function(e){e.dynamic&&(i=!0),o.push(e.type)});var s="tuple("+o.join(",")+")";return(n=a.call(this,e,"tuple",s,r,i)||this).coders=t,n}return i(e,a),e.prototype.encode=function(e){return C(this.coders,e)},e.prototype.decode=function(e,t){var r=B(this.coders,e,t);return r.value=this.coerceFunc(this.type,r.value),r},e}(_);function U(e){e=e.trim();for(var t=[],r="",n=0,i=0;i<e.length;i++){var o=e[i];if(","===o&&0===n)t.push(r),r="";else if(r+=o,"("===o)n++;else if(")"===o&&-1===--n)throw new Error("unbalanced parenthsis")}return r&&t.push(r),t}var F={address:P,bool:k,string:R,bytes:T};function j(e,t){var r,n=F[t.type];if(n)return new n(e,t.name);if(r=t.type.match(p))return(0===(i=parseInt(r[2]||"256"))||256<i||i%8!=0)&&l.throwError("invalid "+r[1]+" bit length",l.INVALID_ARGUMENT,{arg:"param",value:t}),new E(e,i/8,"int"===r[1],t.name);if(r=t.type.match(d))return(0===(i=parseInt(r[1]))||32<i)&&l.throwError("invalid bytes length",l.INVALID_ARGUMENT,{arg:"param",value:t}),new N(e,i,t.name);if(r=t.type.match(v)){var i=parseInt(r[2]||"-1");return(t=c.shallowCopy(t)).type=r[1],t=c.deepCopy(t),new D(e,j(e,t),i,t.name)}return"tuple"===t.type.substring(0,5)?function(t,e,r){e||(e=[]);var n=[];return e.forEach(function(e){n.push(j(t,e))}),new L(t,n,r)}(e,t.components,t.name):""===t.type?new A(e,t.name):(l.throwError("invalid type",l.INVALID_ARGUMENT,{arg:"type",value:t.type}),null)}var G=function(){function t(e){l.checkNew(this,t),e||(e=r.defaultCoerceFunc),c.defineReadOnly(this,"coerceFunc",e)}return t.prototype.encode=function(e,t){e.length!==t.length&&l.throwError("types/values length mismatch",l.INVALID_ARGUMENT,{count:{types:e.length,values:t.length},value:{types:e,values:t}});var r=[];return e.forEach(function(e){var t=null;t="string"==typeof e?b(e):e,r.push(j(this.coerceFunc,t))},this),f.hexlify(new L(this.coerceFunc,r,"_").encode(t))},t.prototype.decode=function(e,t){var r=[];return e.forEach(function(e){var t=null;t="string"==typeof e?b(e):c.deepCopy(e),r.push(j(this.coerceFunc,t))},this),new L(this.coerceFunc,r,"_").decode(f.arrayify(t),0).value},t}();r.AbiCoder=G,r.defaultAbiCoder=new G},{"../constants":3,"../errors":5,"./address":59,"./bignumber":61,"./bytes":62,"./properties":72,"./utf8":83}],59:[function(e,t,r){"use strict";var n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(r,"__esModule",{value:!0});var i=n(e("bn.js")),o=e("./bytes"),s=e("./keccak256"),a=e("./rlp"),u=e("../errors");function l(e){"string"==typeof e&&e.match(/^0x[0-9A-Fa-f]{40}$/)||u.throwError("invalid address",u.INVALID_ARGUMENT,{arg:"address",value:e});for(var t=(e=e.toLowerCase()).substring(2).split(""),r=new Uint8Array(40),n=0;n<40;n++)r[n]=t[n].charCodeAt(0);r=o.arrayify(s.keccak256(r));for(var i=0;i<40;i+=2)8<=r[i>>1]>>4&&(t[i]=t[i].toUpperCase()),8<=(15&r[i>>1])&&(t[i+1]=t[i+1].toUpperCase());return"0x"+t.join("")}for(var f={},h=0;h<10;h++)f[String(h)]=String(h);for(h=0;h<26;h++)f[String.fromCharCode(65+h)]=String(10+h);var c,d=Math.floor((c=9007199254740991,Math.log10?Math.log10(c):Math.log(c)/Math.LN10));function p(e){e=(e=e.toUpperCase()).substring(4)+e.substring(0,2)+"00";var t="";for(e.split("").forEach(function(e){t+=f[e]});t.length>=d;){var r=t.substring(0,d);t=parseInt(r,10)%97+t.substring(r.length)}for(var n=String(98-parseInt(t,10)%97);n.length<2;)n="0"+n;return n}function v(e){var t=null;if("string"!=typeof e&&u.throwError("invalid address",u.INVALID_ARGUMENT,{arg:"address",value:e}),e.match(/^(0x)?[0-9a-fA-F]{40}$/))"0x"!==e.substring(0,2)&&(e="0x"+e),t=l(e),e.match(/([A-F].*[a-f])|([a-f].*[A-F])/)&&t!==e&&u.throwError("bad address checksum",u.INVALID_ARGUMENT,{arg:"address",value:e});else if(e.match(/^XE[0-9]{2}[0-9A-Za-z]{30,31}$/)){for(e.substring(2,4)!==p(e)&&u.throwError("bad icap checksum",u.INVALID_ARGUMENT,{arg:"address",value:e}),t=new i.default.BN(e.substring(4),36).toString(16);t.length<40;)t="0"+t;t=l("0x"+t)}else u.throwError("invalid address",u.INVALID_ARGUMENT,{arg:"address",value:e});return t}r.getAddress=v,r.getIcapAddress=function(e){for(var t=new i.default.BN(v(e).substring(2),16).toString(36).toUpperCase();t.length<30;)t="0"+t;return"XE"+p("XE00"+t)+t},r.getContractAddress=function(e){if(!e.from)throw new Error("missing from address");var t=e.nonce;return v("0x"+s.keccak256(a.encode([v(e.from),o.stripZeros(o.hexlify(t))])).substring(26))}},{"../errors":5,"./bytes":62,"./keccak256":69,"./rlp":74,"bn.js":9}],60:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("../utils/bytes");t.exports={decode:function(e){e=atob(e);for(var t=[],r=0;r<e.length;r++)t.push(e.charCodeAt(r));return n.arrayify(t)},encode:function(e){e=n.arrayify(e);for(var t="",r=0;r<e.length;r++)t+=String.fromCharCode(e[r]);return btoa(t)}}},{"../utils/bytes":62}],61:[function(e,t,r){"use strict";var n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}},i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var o=n(e("bn.js")),s=e("./bytes"),a=e("./properties"),u=i(e("../errors")),l=new o.default.BN(-1);function f(e){var t=e.toString(16);return"-"===t[0]?t.length%2==0?"-0x0"+t.substring(1):"-0x"+t.substring(1):t.length%2==1?"0x0"+t:"0x"+t}function h(e){return d(v(e))}function c(e){return new p(f(e))}function d(e){var t=e._hex;return"-"===t[0]?new o.default.BN(t.substring(3),16).mul(l):new o.default.BN(t.substring(2),16)}var p=function(){function t(e){if(u.checkNew(this,t),a.setType(this,"BigNumber"),"string"==typeof e)s.isHexString(e)?("0x"==e&&(e="0x0"),a.defineReadOnly(this,"_hex",e)):"-"===e[0]&&s.isHexString(e.substring(1))?a.defineReadOnly(this,"_hex",e):e.match(/^-?[0-9]*$/)?(""==e&&(e="0"),a.defineReadOnly(this,"_hex",f(new o.default.BN(e)))):u.throwError("invalid BigNumber string value",u.INVALID_ARGUMENT,{arg:"value",value:e});else if("number"==typeof e){parseInt(String(e))!==e&&u.throwError("underflow",u.NUMERIC_FAULT,{operation:"setValue",fault:"underflow",value:e,outputValue:parseInt(String(e))});try{a.defineReadOnly(this,"_hex",f(new o.default.BN(e)))}catch(e){u.throwError("overflow",u.NUMERIC_FAULT,{operation:"setValue",fault:"overflow",details:e.message})}}else e instanceof t?a.defineReadOnly(this,"_hex",e._hex):e.toHexString?a.defineReadOnly(this,"_hex",f(h(e.toHexString()))):e._hex&&s.isHexString(e._hex)?a.defineReadOnly(this,"_hex",e._hex):s.isArrayish(e)?a.defineReadOnly(this,"_hex",f(new o.default.BN(s.hexlify(e).substring(2),16))):u.throwError("invalid BigNumber value",u.INVALID_ARGUMENT,{arg:"value",value:e})}return t.prototype.fromTwos=function(e){return c(d(this).fromTwos(e))},t.prototype.toTwos=function(e){return c(d(this).toTwos(e))},t.prototype.add=function(e){return c(d(this).add(h(e)))},t.prototype.sub=function(e){return c(d(this).sub(h(e)))},t.prototype.div=function(e){return v(e).isZero()&&u.throwError("division by zero",u.NUMERIC_FAULT,{operation:"divide",fault:"division by zero"}),c(d(this).div(h(e)))},t.prototype.mul=function(e){return c(d(this).mul(h(e)))},t.prototype.mod=function(e){return c(d(this).mod(h(e)))},t.prototype.pow=function(e){return c(d(this).pow(h(e)))},t.prototype.maskn=function(e){return c(d(this).maskn(e))},t.prototype.eq=function(e){return d(this).eq(h(e))},t.prototype.lt=function(e){return d(this).lt(h(e))},t.prototype.lte=function(e){return d(this).lte(h(e))},t.prototype.gt=function(e){return d(this).gt(h(e))},t.prototype.gte=function(e){return d(this).gte(h(e))},t.prototype.isZero=function(){return d(this).isZero()},t.prototype.toNumber=function(){try{return d(this).toNumber()}catch(e){u.throwError("overflow",u.NUMERIC_FAULT,{operation:"setValue",fault:"overflow",details:e.message})}return null},t.prototype.toString=function(){return d(this).toString(10)},t.prototype.toHexString=function(){return this._hex},t.isBigNumber=function(e){return a.isType(e,"BigNumber")},t}();function v(e){return p.isBigNumber(e)?e:new p(e)}r.BigNumber=p,r.bigNumberify=v},{"../errors":5,"./bytes":62,"./properties":72,"bn.js":9}],62:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var a=n(e("../errors"));function s(e){return!!e.toHexString}function u(t){return t.slice||(t.slice=function(){var e=Array.prototype.slice.call(arguments);return new Uint8Array(Array.prototype.slice.apply(t,e))}),t}function l(e){if(!e||parseInt(String(e.length))!=e.length||"string"==typeof e)return!1;for(var t=0;t<e.length;t++){var r=e[t];if(r<0||256<=r||parseInt(String(r))!=r)return!1}return!0}function f(e){if(null==e&&a.throwError("cannot convert null value to array",a.INVALID_ARGUMENT,{arg:"value",value:e}),s(e)&&(e=e.toHexString()),"string"==typeof e){var t=e.match(/^(0x)?[0-9a-fA-F]*$/);t||a.throwError("invalid hexidecimal string",a.INVALID_ARGUMENT,{arg:"value",value:e}),"0x"!==t[1]&&a.throwError("hex string must have 0x prefix",a.INVALID_ARGUMENT,{arg:"value",value:e}),(e=e.substring(2)).length%2&&(e="0"+e);for(var r=[],n=0;n<e.length;n+=2)r.push(parseInt(e.substr(n,2),16));return u(new Uint8Array(r))}return l(e)?u(new Uint8Array(e)):(a.throwError("invalid arrayify value",null,{arg:"value",value:e,type:typeof e}),null)}function i(e){for(var t=[],r=0,n=0;n<e.length;n++){var i=f(e[n]);t.push(i),r+=i.length}var o=new Uint8Array(r),s=0;for(n=0;n<t.length;n++)o.set(t[n],s),s+=t[n].length;return u(o)}function o(e,t){return!("string"!=typeof e||!e.match(/^0x[0-9A-Fa-f]*$/))&&(!t||e.length===2+2*t)}r.isHexable=s,r.isArrayish=l,r.arrayify=f,r.concat=i,r.stripZeros=function(e){var t=f(e);if(0===t.length)return t;for(var r=0;0===t[r];)r++;return r&&(t=t.slice(r)),t},r.padZeros=function(e,t){if(t<(e=f(e)).length)throw new Error("cannot pad");var r=new Uint8Array(t);return r.set(e,t-e.length),u(r)},r.isHexString=o;var h="0123456789abcdef";function c(e){if(s(e))return e.toHexString();if("number"==typeof e){e<0&&a.throwError("cannot hexlify negative value",a.INVALID_ARGUMENT,{arg:"value",value:e});for(var t="";e;)t=h[15&e]+t,e=Math.floor(e/16);return t.length?(t.length%2&&(t="0"+t),"0x"+t):"0x00"}if("string"==typeof e){var r=e.match(/^(0x)?[0-9a-fA-F]*$/);return r||a.throwError("invalid hexidecimal string",a.INVALID_ARGUMENT,{arg:"value",value:e}),"0x"!==r[1]&&a.throwError("hex string must have 0x prefix",a.INVALID_ARGUMENT,{arg:"value",value:e}),e.length%2&&(e="0x0"+e.substring(2)),e}if(l(e)){for(var n=[],i=0;i<e.length;i++){var o=e[i];n.push(h[(240&o)>>4]+h[15&o])}return"0x"+n.join("")}return a.throwError("invalid hexlify value",null,{arg:"value",value:e}),"never"}function d(e,t){for(o(e)||a.throwError("invalid hex string",a.INVALID_ARGUMENT,{arg:"value",value:e});e.length<2*t+2;)e="0x0"+e.substring(2);return e}function p(e){var t,r=0,n="0x",i="0x";if((t=e)&&null!=t.r&&null!=t.s){null==e.v&&null==e.recoveryParam&&a.throwError("at least on of recoveryParam or v must be specified",a.INVALID_ARGUMENT,{argument:"signature",value:e}),n=d(e.r,32),i=d(e.s,32),"string"==typeof(r=e.v)&&(r=parseInt(r,16));var o=e.recoveryParam;null==o&&null!=e.v&&(o=1-r%2),r=27+o}else{var s=f(e);if(65!==s.length)throw new Error("invalid signature");n=c(s.slice(0,32)),i=c(s.slice(32,64)),27!==(r=s[64])&&28!==r&&(r=27+r%2)}return{r:n,s:i,recoveryParam:r-27,v:r}}r.hexlify=c,r.hexDataLength=function(e){return o(e)&&e.length%2==0?(e.length-2)/2:null},r.hexDataSlice=function(e,t,r){return o(e)||a.throwError("invalid hex data",a.INVALID_ARGUMENT,{arg:"value",value:e}),e.length%2!=0&&a.throwError("hex data length must be even",a.INVALID_ARGUMENT,{arg:"value",value:e}),t=2+2*t,null!=r?"0x"+e.substring(t,2+2*r):"0x"+e.substring(t)},r.hexStripZeros=function(e){for(o(e)||a.throwError("invalid hex string",a.INVALID_ARGUMENT,{arg:"value",value:e});3<e.length&&"0x0"===e.substring(0,3);)e="0x"+e.substring(3);return e},r.hexZeroPad=d,r.splitSignature=p,r.joinSignature=function(e){return c(i([(e=p(e)).r,e.s,e.recoveryParam?"0x1c":"0x1b"]))}},{"../errors":5}],63:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var i=e("./bytes"),o=e("./utf8"),s=e("./keccak256"),a=new Uint8Array([0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0]),u=new RegExp("^((.*)\\.)?([^.]+)$"),l=new RegExp("^[a-z0-9.-]*$");r.namehash=function(e){if(!(e=e.toLowerCase()).match(l))throw new Error("contains invalid UseSTD3ASCIIRules characters");for(var t=a;e.length;){var r=e.match(u),n=o.toUtf8Bytes(r[3]);t=s.keccak256(i.concat([t,s.keccak256(n)])),e=r[2]||""}return i.hexlify(t)},r.id=function(e){return s.keccak256(o.toUtf8Bytes(e))},r.hashMessage=function(e){var t=i.concat([o.toUtf8Bytes("\x19Ethereum Signed Message:\n"),o.toUtf8Bytes(String(e.length)),"string"==typeof e?o.toUtf8Bytes(e):e]);return s.keccak256(t)}},{"./bytes":62,"./keccak256":69,"./utf8":83}],64:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var h=n(e("../errors")),c=e("../wordlists/lang-en"),d=e("./bytes"),f=e("./bignumber"),i=e("./utf8"),o=e("./pbkdf2"),p=e("./hmac"),a=e("./properties"),u=e("./secp256k1"),v=e("./sha2"),m=f.bigNumberify("0xfffffffffffffffffffffffffffffffebaaedce6af48a03bbfd25e8cd0364141"),s=i.toUtf8Bytes("Bitcoin seed"),y=2147483648;function g(e){return(1<<e)-1<<8-e}var b={};r.defaultPath="m/44'/60'/0'/0/0";var l=function(){function l(e,t,r,n,i,o,s){if(h.checkNew(this,l),e!==b)throw new Error("HDNode constructor cannot be called directly");a.defineReadOnly(this,"keyPair",new u.KeyPair(t)),a.defineReadOnly(this,"privateKey",this.keyPair.privateKey),a.defineReadOnly(this,"publicKey",this.keyPair.compressedPublicKey),a.defineReadOnly(this,"address",u.computeAddress(this.publicKey)),a.defineReadOnly(this,"chainCode",d.hexlify(r)),a.defineReadOnly(this,"index",n),a.defineReadOnly(this,"depth",i),a.defineReadOnly(this,"mnemonic",o),a.defineReadOnly(this,"path",s),a.setType(this,"HDNode")}return l.prototype._derive=function(e){if(!this.privateKey){if(y<=e)throw new Error("cannot derive child of neutered node");throw new Error("not implemented")}var t=new Uint8Array(37),r=this.mnemonic,n=this.path;n&&(n+="/"+e),e&y?(t.set(d.arrayify(this.privateKey),1),n&&(n+="'")):t.set(this.keyPair.publicKeyBytes);for(var i=24;0<=i;i-=8)t[33+(i>>3)]=e>>24-i&255;var o=p.computeHmac(p.SupportedAlgorithms.sha512,this.chainCode,t),s=f.bigNumberify(o.slice(0,32)),a=o.slice(32),u=s.add(this.keyPair.privateKey).mod(m);return new l(b,d.arrayify(u),a,e,this.depth+1,r,n)},l.prototype.derivePath=function(e){var t=e.split("/");if(0===t.length||"m"===t[0]&&0!==this.depth)throw new Error("invalid path");"m"===t[0]&&t.shift();for(var r=this,n=0;n<t.length;n++){var i=t[n];if(i.match(/^[0-9]+'$/)){var o=parseInt(i.substring(0,i.length-1));if(y<=o)throw new Error("invalid path index - "+i);r=r._derive(y+o)}else{if(!i.match(/^[0-9]+$/))throw new Error("invlaid path component - "+i);o=parseInt(i);if(y<=o)throw new Error("invalid path index - "+i);r=r._derive(o)}}return r},l.isHDNode=function(e){return a.isType(e,"HDNode")},l}();function w(e,t){var r=d.arrayify(e);if(r.length<16||64<r.length)throw new Error("invalid seed");var n=d.arrayify(p.computeHmac(p.SupportedAlgorithms.sha512,s,r));return new l(b,n.slice(0,32),n.slice(32),0,0,t,"m")}function _(e,t){t||(t="");var r=i.toUtf8Bytes("mnemonic"+t,i.UnicodeNormalizationForm.NFKD);return d.hexlify(o.pbkdf2(i.toUtf8Bytes(e,i.UnicodeNormalizationForm.NFKD),r,2048,64,"sha512"))}function M(e,t){t||(t=c.langEn),h.checkNormalize();var r=t.split(e);if(r.length%3!=0)throw new Error("invalid mnemonic");for(var n=d.arrayify(new Uint8Array(Math.ceil(11*r.length/8))),i=0,o=0;o<r.length;o++){var s=t.getWordIndex(r[o].normalize("NFKD"));if(-1===s)throw new Error("invalid mnemonic");for(var a=0;a<11;a++)s&1<<10-a&&(n[i>>3]|=1<<7-i%8),i++}var u=32*r.length/3,l=g(r.length/3),f=d.arrayify(v.sha256(n.slice(0,u/8)))[0];if((f&=l)!==(n[n.length-1]&l))throw new Error("invalid checksum");return d.hexlify(n.slice(0,u/8))}r.HDNode=l,r.fromMnemonic=function(e,t){return M(e,t),w(_(e),e)},r.fromSeed=function(e){return w(e,null)},r.mnemonicToSeed=_,r.mnemonicToEntropy=M,r.entropyToMnemonic=function(e,t){if((e=d.arrayify(e)).length%4!=0||e.length<16||32<e.length)throw new Error("invalid entropy");for(var r=[0],n=11,i=0;i<e.length;i++)8<n?(r[r.length-1]<<=8,r[r.length-1]|=e[i],n-=8):(r[r.length-1]<<=n,r[r.length-1]|=e[i]>>8-n,r.push(e[i]&(1<<8-n)-1),n+=3);var o=d.arrayify(v.sha256(e))[0],s=e.length/4;return o&=g(s),r[r.length-1]<<=s,r[r.length-1]|=o>>8-s,t||(t=c.langEn),t.join(r.map(function(e){return t.getWord(e)}))},r.isValidMnemonic=function(e,t){try{return M(e,t),!0}catch(e){}return!1}},{"../errors":5,"../wordlists/lang-en":88,"./bignumber":61,"./bytes":62,"./hmac":65,"./pbkdf2":71,"./properties":72,"./secp256k1":75,"./sha2":77,"./utf8":83}],65:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i,o,s=n(e("hash.js")),a=e("../utils/bytes"),u=n(e("../errors"));(o=i=r.SupportedAlgorithms||(r.SupportedAlgorithms={})).sha256="sha256",o.sha512="sha512",r.computeHmac=function(e,t,r){return i[e]||u.throwError("unsupported algorithm "+e,u.UNSUPPORTED_OPERATION,{operation:"hmac",algorithm:e}),a.arrayify(s.hmac(s[e],a.arrayify(t)).update(a.arrayify(r)).digest())}},{"../errors":5,"../utils/bytes":62,"hash.js":27}],66:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=e("./abi-coder");r.AbiCoder=i.AbiCoder,r.defaultAbiCoder=i.defaultAbiCoder,r.formatSignature=i.formatSignature,r.formatParamType=i.formatParamType,r.parseSignature=i.parseSignature,r.parseParamType=i.parseParamType;var o=e("./address");r.getAddress=o.getAddress,r.getContractAddress=o.getContractAddress,r.getIcapAddress=o.getIcapAddress;var s=n(e("./base64"));r.base64=s;var a=e("./bignumber");r.BigNumber=a.BigNumber,r.bigNumberify=a.bigNumberify;var u=e("./bytes");r.arrayify=u.arrayify,r.concat=u.concat,r.hexDataSlice=u.hexDataSlice,r.hexDataLength=u.hexDataLength,r.hexlify=u.hexlify,r.hexStripZeros=u.hexStripZeros,r.hexZeroPad=u.hexZeroPad,r.joinSignature=u.joinSignature,r.padZeros=u.padZeros,r.splitSignature=u.splitSignature,r.stripZeros=u.stripZeros;var l=e("./hash");r.hashMessage=l.hashMessage,r.id=l.id,r.namehash=l.namehash;var f=n(e("./hdnode"));r.HDNode=f;var h=e("./interface");r.Interface=h.Interface;var c=e("./json-wallet");r.getJsonWalletAddress=c.getJsonWalletAddress;var d=e("./keccak256");r.keccak256=d.keccak256;var p=e("./sha2");r.sha256=p.sha256;var v=e("./solidity");r.solidityKeccak256=v.keccak256,r.solidityPack=v.pack,r.soliditySha256=v.sha256;var m=e("./random-bytes");r.randomBytes=m.randomBytes;var y=e("./networks");r.getNetwork=y.getNetwork;var g=e("./properties");r.checkProperties=g.checkProperties,r.deepCopy=g.deepCopy,r.defineReadOnly=g.defineReadOnly,r.resolveProperties=g.resolveProperties,r.shallowCopy=g.shallowCopy;var b=n(e("./rlp"));r.RLP=b;var w=e("./secp256k1");r.computeAddress=w.computeAddress,r.computePublicKey=w.computePublicKey,r.recoverAddress=w.recoverAddress,r.recoverPublicKey=w.recoverPublicKey,r.verifyMessage=w.verifyMessage;var _=e("./signing-key");r.SigningKey=_.SigningKey;var M=e("./transaction");r.populateTransaction=M.populateTransaction;var A=e("./transaction");r.parseTransaction=A.parse,r.serializeTransaction=A.serialize;var E=e("./utf8");r.formatBytes32String=E.formatBytes32String,r.parseBytes32String=E.parseBytes32String,r.toUtf8Bytes=E.toUtf8Bytes,r.toUtf8String=E.toUtf8String;var S=e("./units");r.commify=S.commify,r.formatEther=S.formatEther,r.parseEther=S.parseEther,r.formatUnits=S.formatUnits,r.parseUnits=S.parseUnits;var k=e("./web");r.fetchJson=k.fetchJson;var N=e("./hmac");r.SupportedAlgorithms=N.SupportedAlgorithms;var P=e("./utf8");r.UnicodeNormalizationForm=P.UnicodeNormalizationForm;var x=e("./wordlist");r.Wordlist=x.Wordlist},{"./abi-coder":58,"./address":59,"./base64":60,"./bignumber":61,"./bytes":62,"./hash":63,"./hdnode":64,"./hmac":65,"./interface":67,"./json-wallet":68,"./keccak256":69,"./networks":70,"./properties":72,"./random-bytes":73,"./rlp":74,"./secp256k1":75,"./sha2":77,"./signing-key":79,"./solidity":80,"./transaction":81,"./units":82,"./utf8":83,"./web":84,"./wordlist":85}],67:[function(e,t,r){"use strict";var n,i=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),o=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var s=e("./address"),h=e("./abi-coder"),a=e("./bignumber"),c=e("./bytes"),u=e("./hash"),l=e("./keccak256"),f=e("./properties"),d=o(e("../errors")),p=function(e){f.setType(this,"Indexed"),f.defineReadOnly(this,"hash",e)},v=function(e){for(var t in f.setType(this,"Description"),e)f.defineReadOnly(this,t,f.deepCopy(e[t],!0));Object.freeze(this)},m=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return i(t,e),t.prototype.encode=function(e,t){c.isHexString(e)||d.throwError("invalid contract bytecode",d.INVALID_ARGUMENT,{arg:"bytecode",value:e}),d.checkArgumentCount(t.length,this.inputs.length," in Interface constructor");try{return e+h.defaultAbiCoder.encode(this.inputs,t).substring(2)}catch(e){d.throwError("invalid constructor argument",d.INVALID_ARGUMENT,{arg:e.arg,reason:e.reason,value:e.value})}return null},t}(v),y=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return i(t,e),t.prototype.encode=function(e){d.checkArgumentCount(e.length,this.inputs.length," in interface function "+this.name);try{return this.sighash+h.defaultAbiCoder.encode(this.inputs,e).substring(2)}catch(e){d.throwError("invalid input argument",d.INVALID_ARGUMENT,{arg:e.arg,reason:e.reason,value:e.value})}return null},t.prototype.decode=function(t){try{return h.defaultAbiCoder.decode(this.outputs,c.arrayify(t))}catch(e){d.throwError("invalid data for function output",d.INVALID_ARGUMENT,{arg:"data",errorArg:e.arg,errorValue:e.value,value:t,reason:e.reason})}},t}(v),g=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return i(t,e),t}(v),b=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return i(t,e),t.prototype.encodeTopics=function(e){var n=this;e.length>this.inputs.length&&d.throwError("too many arguments for "+this.name,d.UNEXPECTED_ARGUMENT,{maxCount:e.length,expectedCount:this.inputs.length});var i=[];for(this.anonymous||i.push(this.topic),e.forEach(function(e,t){var r=n.inputs[t];r.indexed?null==e?i.push(null):"string"===r.type?i.push(u.id(e)):"bytes"===r.type?i.push(l.keccak256(e)):-1!==r.type.indexOf("[")||"tuple"===r.type.substring(0,5)?d.throwError("filtering with tuples or arrays not implemented yet; bug us on GitHub",d.NOT_IMPLEMENTED,{operation:"filter(array|tuple)"}):("address"===r.type&&s.getAddress(e),i.push(c.hexZeroPad(c.hexlify(e),32).toLowerCase())):null!=e&&d.throwError("cannot filter non-indexed parameters; must be null",d.INVALID_ARGUMENT,{argument:r.name||t,value:e})});i.length&&null===i[i.length-1];)i.pop();return i},t.prototype.decode=function(e,r){null==r||this.anonymous||(r=r.slice(1));var n=[],i=[],o=[];if(this.inputs.forEach(function(e,t){e.indexed?"string"===e.type||"bytes"===e.type||0<=e.type.indexOf("[")||"tuple"===e.type.substring(0,5)?(n.push({type:"bytes32",name:e.name||""}),o.push(!0)):(n.push(e),o.push(!1)):(i.push(e),o.push(!1))}),null!=r)var s=h.defaultAbiCoder.decode(n,c.concat(r));var a=h.defaultAbiCoder.decode(i,c.arrayify(e)),u={},l=0,f=0;return this.inputs.forEach(function(e,t){e.indexed?null==r?u[t]=new p(null):o[t]?u[t]=new p(s[f++]):u[t]=s[f++]:u[t]=a[l++],e.name&&(u[e.name]=u[t])}),u.length=this.inputs.length,new g(u)},t}(v),w=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return i(t,e),t}(v),_=function(e){function t(){return null!==e&&e.apply(this,arguments)||this}return i(t,e),t}(v);function M(e){switch(e.type){case"constructor":var t=new m({inputs:e.inputs,payable:null==e.payable||!!e.payable});this.deployFunction||(this.deployFunction=t);break;case"function":var r=h.formatSignature(e).replace(/tuple/g,""),n=u.id(r).substring(0,10);t=new y({inputs:e.inputs,outputs:e.outputs,gas:e.gas,payable:null==e.payable||!!e.payable,type:e.constant?"call":"transaction",signature:r,sighash:n});e.name&&null==this.functions[e.name]&&f.defineReadOnly(this.functions,e.name,t),null==this.functions[t.signature]&&f.defineReadOnly(this.functions,t.signature,t);break;case"event":r=h.formatSignature(e).replace(/tuple/g,""),t=new b({name:e.name,signature:r,inputs:e.inputs,topic:u.id(r),anonymous:!!e.anonymous});e.name&&null==this.events[e.name]&&f.defineReadOnly(this.events,e.name,t),null==this.events[t.signature]&&f.defineReadOnly(this.events,t.signature,t);break;case"fallback":break;default:console.log("WARNING: unsupported ABI type - "+e.type)}}var A=function(){function e(t){if(d.checkNew(this,e),"string"==typeof t){try{t=JSON.parse(t)}catch(e){d.throwError("could not parse ABI JSON",d.INVALID_ARGUMENT,{arg:"abi",errorMessage:e.message,value:t})}if(!Array.isArray(t))return d.throwError("invalid abi",d.INVALID_ARGUMENT,{arg:"abi",value:t}),null}f.defineReadOnly(this,"functions",{}),f.defineReadOnly(this,"events",{});var r=[];t.forEach(function(e){"string"==typeof e&&(e=h.parseSignature(e)),r.push(e)}),f.defineReadOnly(this,"abi",f.deepCopy(r,!0)),r.forEach(M,this),this.deployFunction||M.call(this,{type:"constructor",inputs:[]}),f.setType(this,"Interface")}return e.prototype.parseTransaction=function(e){var t=e.data.substring(0,10).toLowerCase();for(var r in this.functions)if(-1!==r.indexOf("(")){var n=this.functions[r];if(n.sighash===t){var i=h.defaultAbiCoder.decode(n.inputs,"0x"+e.data.substring(10));return new w({args:i,decode:n.decode,name:r,signature:n.signature,sighash:n.sighash,value:a.bigNumberify(e.value||null)})}}return null},e.prototype.parseLog=function(e){for(var t in this.events)if(-1!==t.indexOf("(")){var r=this.events[t];if(!r.anonymous&&r.topic===e.topics[0])return new _({decode:r.decode,name:r.name,signature:r.signature,topic:r.topic,values:r.decode(e.data,e.topics)})}return null},e.isInterface=function(e){return f.isType(e,"Interface")},e.isIndexed=function(e){return f.isType(e,"Indexed")},e}();r.Interface=A},{"../errors":5,"./abi-coder":58,"./address":59,"./bignumber":61,"./bytes":62,"./hash":63,"./keccak256":69,"./properties":72}],68:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("./address");function i(e){try{var t=JSON.parse(e)}catch(e){return!1}return t.encseed&&t.ethaddr}function o(e){try{var t=JSON.parse(e)}catch(e){return!1}return!(!t.version||parseInt(t.version)!==t.version||3!==parseInt(t.version))}r.isCrowdsaleWallet=i,r.isSecretStorageWallet=o,r.getJsonWalletAddress=function(e){if(i(e))try{return n.getAddress(JSON.parse(e).ethaddr)}catch(e){return null}if(o(e))try{return n.getAddress(JSON.parse(e).address)}catch(e){return null}return null}},{"./address":59}],69:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("js-sha3"),i=e("./bytes");r.keccak256=function(e){return"0x"+n.keccak_256(i.arrayify(e))}},{"./bytes":62,"js-sha3":40}],70:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var o=n(e("../errors"));function i(r){return function(e){var t=[];return e.InfuraProvider&&t.push(new e.InfuraProvider(r)),e.EtherscanProvider&&t.push(new e.EtherscanProvider(r)),0===t.length?null:e.FallbackProvider?new e.FallbackProvider(t):t[0]}}function s(t,r){return function(e){return e.JsonRpcProvider?new e.JsonRpcProvider(t,r):null}}var a={chainId:1,ensAddress:"0x314159265dd8dbb310642f98f50c066173c1259b",name:"homestead",_defaultProvider:i("homestead")},u={chainId:3,ensAddress:"0x112234455c3a32fd11230c42e7bccd4a84e02010",name:"ropsten",_defaultProvider:i("ropsten")},l={unspecified:{chainId:0,name:"unspecified"},homestead:a,mainnet:a,morden:{chainId:2,name:"morden"},ropsten:u,testnet:u,rinkeby:{chainId:4,ensAddress:"0xe7410170f87102DF0055eB195163A03B7F2Bff4A",name:"rinkeby",_defaultProvider:i("rinkeby")},kovan:{chainId:42,name:"kovan",_defaultProvider:i("kovan")},classic:{chainId:61,name:"classic",_defaultProvider:s("https://web3.gastracker.io","classic")},classicTestnet:{chainId:62,name:"classicTestnet",_defaultProvider:s("https://web3.gastracker.io/morden","classicTestnet")}};r.getNetwork=function(e){if(null==e)return null;if("number"==typeof e){for(var t in l){var r=l[t];if(r.chainId===e)return{name:r.name,chainId:r.chainId,ensAddress:r.ensAddress||null,_defaultProvider:r._defaultProvider||null}}return{chainId:e,name:"unknown"}}if("string"==typeof e){var n=l[e];return null==n?null:{name:n.name,chainId:n.chainId,ensAddress:n.ensAddress,_defaultProvider:n._defaultProvider||null}}var i=l[e.name];return i?(0!==e.chainId&&e.chainId!==i.chainId&&o.throwError("network chainId mismatch",o.INVALID_ARGUMENT,{arg:"network",value:e}),{name:e.name,chainId:i.chainId,ensAddress:e.ensAddress||i.ensAddress||null,_defaultProvider:e._defaultProvider||i._defaultProvider||null}):("number"!=typeof e.chainId&&o.throwError("invalid network chainId",o.INVALID_ARGUMENT,{arg:"network",value:e}),e)}},{"../errors":5}],71:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var y=e("../utils/bytes"),g=e("./hmac");r.pbkdf2=function(e,t,r,n,i){var o;e=y.arrayify(e),t=y.arrayify(t);var s,a,u=1,l=new Uint8Array(n),f=new Uint8Array(t.length+4);f.set(t);for(var h=1;h<=u;h++){f[t.length]=h>>24&255,f[t.length+1]=h>>16&255,f[t.length+2]=h>>8&255,f[t.length+3]=255&h;var c=g.computeHmac(i,e,f);o||(o=c.length,a=new Uint8Array(o),s=n-((u=Math.ceil(n/o))-1)*o),a.set(c);for(var d=1;d<r;d++){c=g.computeHmac(i,e,c);for(var p=0;p<o;p++)a[p]^=c[p]}var v=(h-1)*o,m=h===u?s:o;l.set(y.arrayify(a).slice(0,m),v)}return y.arrayify(l)}},{"../utils/bytes":62,"./hmac":65}],72:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=n(e("../errors"));function s(e,t,r){Object.defineProperty(e,t,{enumerable:!0,value:r,writable:!1})}function a(e,t){return e&&e._ethersType===t}r.defineReadOnly=s,r.setType=function(e,t){Object.defineProperty(e,"_ethersType",{configurable:!1,value:t,writable:!1})},r.isType=a,r.resolveProperties=function(r){var n={},i=[];return Object.keys(r).forEach(function(t){var e=r[t];e instanceof Promise?i.push(e.then(function(e){return n[t]=e,null})):n[t]=e}),Promise.all(i).then(function(){return n})},r.checkProperties=function(t,r){t&&"object"==typeof t||i.throwError("invalid object",i.INVALID_ARGUMENT,{argument:"object",value:t}),Object.keys(t).forEach(function(e){r[e]||i.throwError("invalid object key - "+e,i.INVALID_ARGUMENT,{argument:"transaction",value:t,key:e})})},r.shallowCopy=function(e){var t={};for(var r in e)t[r]=e[r];return t};var u={boolean:!0,number:!0,string:!0};r.deepCopy=function t(e,r){if(null==e||u[typeof e])return e;if(Array.isArray(e)){var n=e.map(function(e){return t(e,r)});return r&&Object.freeze(n),n}if("object"==typeof e){if(a(e,"BigNumber"))return e;if(a(e,"Description"))return e;if(a(e,"Indexed"))return e;for(var i in n={},e){var o=e[i];void 0!==o&&s(n,i,t(o,r))}return r&&Object.freeze(n),n}if("function"==typeof e)return e;throw new Error("Cannot deepCopy "+typeof e)},r.inheritable=function n(i){return function(e){var t,r;r=i,(t=e).super_=r,t.prototype=Object.create(r.prototype,{constructor:{value:t,enumerable:!1,writable:!0,configurable:!0}}),s(e,"inherits",n(e))}}},{"../errors":5}],73:[function(o,e,s){(function(e){"use strict";Object.defineProperty(s,"__esModule",{value:!0});var r=o("../utils/bytes"),t=o("../utils/properties"),n=e.crypto||e.msCrypto;function i(e){if(e<=0||1024<e||parseInt(String(e))!=e)throw new Error("invalid length");var t=new Uint8Array(e);return n.getRandomValues(t),r.arrayify(t)}n&&n.getRandomValues||(console.log("WARNING: Missing strong random number source; using weak randomBytes"),n={getRandomValues:function(e){for(var t=0;t<20;t++)for(var r=0;r<e.length;r++)t?e[r]^=Math.trunc(256*Math.random()):e[r]=Math.trunc(256*Math.random());return e},_weakCrypto:!0}),s.randomBytes=i,!0===n._weakCrypto&&t.defineReadOnly(i,"_weakCrypto",!0)}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"../utils/bytes":62,"../utils/properties":72}],74:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var o=e("./bytes");function s(e){for(var t=[];e;)t.unshift(255&e),e>>=8;return t}function i(e,t,r){for(var n=0,i=0;i<r;i++)n=256*n+e[t+i];return n}function a(e,t,r,n){for(var i=[];r<t+1+n;){var o=u(e,r);if(i.push(o.result),t+1+n<(r+=o.consumed))throw new Error("invalid rlp")}return{consumed:1+n,result:i}}function u(e,t){if(0===e.length)throw new Error("invalid rlp data");if(248<=e[t]){if(t+1+(r=e[t]-247)>e.length)throw new Error("too short");if(t+1+r+(n=i(e,t+1,r))>e.length)throw new Error("to short");return a(e,t,t+1+r,r+n)}if(192<=e[t]){if(t+1+(n=e[t]-192)>e.length)throw new Error("invalid rlp data");return a(e,t,t+1,n)}if(184<=e[t]){var r;if(t+1+(r=e[t]-183)>e.length)throw new Error("invalid rlp data");if(t+1+r+(n=i(e,t+1,r))>e.length)throw new Error("invalid rlp data");return{consumed:1+r+n,result:o.hexlify(e.slice(t+1+r,t+1+r+n))}}if(128<=e[t]){var n;if(t+1+(n=e[t]-128)>e.length)throw new Error("invlaid rlp data");return{consumed:1+n,result:o.hexlify(e.slice(t+1,t+1+n))}}return{consumed:1,result:o.hexlify(e[t])}}r.encode=function(e){return o.hexlify(function t(e){if(Array.isArray(e)){var r=[];return e.forEach(function(e){r=r.concat(t(e))}),r.length<=55?(r.unshift(192+r.length),r):((n=s(r.length)).unshift(247+n.length),n.concat(r))}var n,i=Array.prototype.slice.call(o.arrayify(e));return 1===i.length&&i[0]<=127?i:i.length<=55?(i.unshift(128+i.length),i):((n=s(i.length)).unshift(183+n.length),n.concat(i))}(e))},r.decode=function(e){var t=o.arrayify(e),r=u(t,0);if(r.consumed!==t.length)throw new Error("invalid rlp data");return r.result}},{"./bytes":62}],75:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=e("elliptic"),o=e("./address"),s=e("./bytes"),a=e("./hash"),u=e("./keccak256"),l=e("./properties"),f=n(e("../errors")),h=null;function c(){return h||(h=new i.ec("secp256k1")),h}var d=function(){function e(e){var t=c().keyFromPrivate(s.arrayify(e));l.defineReadOnly(this,"privateKey",s.hexlify(t.priv.toArray("be",32))),l.defineReadOnly(this,"publicKey","0x"+t.getPublic(!1,"hex")),l.defineReadOnly(this,"compressedPublicKey","0x"+t.getPublic(!0,"hex")),l.defineReadOnly(this,"publicKeyBytes",t.getPublic().encode(null,!0))}return e.prototype.sign=function(e){var t=c().keyFromPrivate(s.arrayify(this.privateKey)).sign(s.arrayify(e),{canonical:!0});return{recoveryParam:t.recoveryParam,r:s.hexZeroPad("0x"+t.r.toString(16),32),s:s.hexZeroPad("0x"+t.s.toString(16),32),v:27+t.recoveryParam}},e.prototype.computeSharedSecret=function(e){var t=c().keyFromPrivate(s.arrayify(this.privateKey)),r=c().keyFromPublic(s.arrayify(p(e)));return s.hexZeroPad("0x"+t.derive(r.getPublic()).toString(16),32)},e}();function p(e,t){var r=s.arrayify(e);if(32===r.length){var n=new d(r);return t?n.compressedPublicKey:n.publicKey}return 33===r.length?t?s.hexlify(r):"0x"+c().keyFromPublic(r).getPublic(!1,"hex"):65===r.length?t?"0x"+c().keyFromPublic(r).getPublic(!0,"hex"):s.hexlify(r):(f.throwError("invalid public or private key",f.INVALID_ARGUMENT,{arg:"key",value:"[REDACTED]"}),null)}function v(e){var t="0x"+p(e).slice(4);return o.getAddress("0x"+u.keccak256(t).substring(26))}function m(e,t){var r=s.splitSignature(t),n={r:s.arrayify(r.r),s:s.arrayify(r.s)};return"0x"+c().recoverPubKey(s.arrayify(e),n,r.recoveryParam).encode("hex",!1)}function y(e,t){return v(m(s.arrayify(e),t))}r.KeyPair=d,r.computePublicKey=p,r.computeAddress=v,r.recoverPublicKey=m,r.recoverAddress=y,r.verifyMessage=function(e,t){return y(a.hashMessage(e),t)}},{"../errors":5,"./address":59,"./bytes":62,"./hash":63,"./keccak256":69,"./properties":72,elliptic:12}],76:[function(e,t,r){"use strict";var n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}},i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var I=n(e("aes-js")),y=n(e("scrypt-js")),T=n(e("uuid")),R=e("./signing-key"),g=i(e("./hdnode")),b=e("./address"),O=e("./bytes"),w=e("./pbkdf2"),C=e("./keccak256"),p=e("./utf8"),B=e("./random-bytes");function _(e){return"string"==typeof e&&"0x"!==e.substring(0,2)&&(e="0x"+e),O.arrayify(e)}function D(e,t){for(e=String(e);e.length<t;)e="0"+e;return e}function L(e){return"string"==typeof e?p.toUtf8Bytes(e,p.UnicodeNormalizationForm.NFKC):O.arrayify(e)}function M(e,t){for(var r=e,n=t.toLowerCase().split("/"),i=0;i<n.length;i++){var o=null;for(var s in r)if(s.toLowerCase()===n[i]){o=r[s];break}if(null===o)return null;r=o}return r}r.decryptCrowdsale=function(e,t){var r=JSON.parse(e);t=L(t);var n=b.getAddress(M(r,"ethaddr")),i=_(M(r,"encseed"));if(!i||i.length%16!=0)throw new Error("invalid encseed");var o=w.pbkdf2(t,t,2e3,32,"sha256").slice(0,16),s=i.slice(0,16),a=i.slice(16),u=new I.default.ModeOfOperation.cbc(o,s),l=O.arrayify(u.decrypt(a));l=I.default.padding.pkcs7.strip(l);for(var f="",h=0;h<l.length;h++)f+=String.fromCharCode(l[h]);var c=p.toUtf8Bytes(f),d=new R.SigningKey(C.keccak256(c));if(d.address!==n)throw new Error("corrupt crowdsale wallet");return d},r.decrypt=function(e,t,d){var m=JSON.parse(e),p=L(t),v=function(e,t){var r,n,i=_(M(m,"crypto/ciphertext"));if(O.hexlify((r=e.slice(16,32),n=i,C.keccak256(O.concat([r,n])))).substring(2)!==M(m,"crypto/mac").toLowerCase())return t(new Error("invalid password")),null;var o=function(e,t){if("aes-128-ctr"===M(m,"crypto/cipher")){var r=_(M(m,"crypto/cipherparams/iv")),n=new I.default.Counter(r),i=new I.default.ModeOfOperation.ctr(e,n);return O.arrayify(i.decrypt(t))}return null}(e.slice(0,16),i),s=e.slice(32,64);if(!o)return t(new Error("unsupported cipher")),null;var a=new R.SigningKey(o);if(a.address!==b.getAddress(m.address))return t(new Error("address mismatch")),null;if("0.1"===M(m,"x-ethers/version")){var u=_(M(m,"x-ethers/mnemonicCiphertext")),l=_(M(m,"x-ethers/mnemonicCounter")),f=new I.default.Counter(l),h=new I.default.ModeOfOperation.ctr(s,f),c=M(m,"x-ethers/path")||g.defaultPath,d=O.arrayify(h.decrypt(u)),p=g.entropyToMnemonic(d),v=g.fromMnemonic(p).derivePath(c);if(v.privateKey!=O.hexlify(o))return t(new Error("mnemonic mismatch")),null;a=new R.SigningKey(v)}return a};return new Promise(function(i,o){var e=M(m,"crypto/kdf");if(e&&"string"==typeof e)if("scrypt"===e.toLowerCase()){var t=_(M(m,"crypto/kdfparams/salt")),r=parseInt(M(m,"crypto/kdfparams/n")),n=parseInt(M(m,"crypto/kdfparams/r")),s=parseInt(M(m,"crypto/kdfparams/p"));if(!r||!n||!s)return void o(new Error("unsupported key-derivation function parameters"));if(0!=(r&r-1))return void o(new Error("unsupported key-derivation function parameter value for N"));if(32!==(l=parseInt(M(m,"crypto/kdfparams/dklen"))))return void o(new Error("unsupported key-derivation derived-key length"));d&&d(0),y.default(p,t,r,n,s,64,function(e,t,r){if(e)e.progress=t,o(e);else if(r){r=O.arrayify(r);var n=v(r,o);if(!n)return;d&&d(1),i(n)}else if(d)return d(t)})}else if("pbkdf2"===e.toLowerCase()){t=_(M(m,"crypto/kdfparams/salt"));var a=null,u=M(m,"crypto/kdfparams/prf");if("hmac-sha256"===u)a="sha256";else{if("hmac-sha512"!==u)return void o(new Error("unsupported prf"));a="sha512"}var l,f=parseInt(M(m,"crypto/kdfparams/c"));if(32!==(l=parseInt(M(m,"crypto/kdfparams/dklen"))))return void o(new Error("unsupported key-derivation derived-key length"));var h=w.pbkdf2(p,t,f,l,a),c=v(h,o);if(!c)return;i(c)}else o(new Error("unsupported key-derivation function"));else o(new Error("unsupported key-derivation function"))})},r.encrypt=function(e,t,r,w){"function"!=typeof r||w||(w=r,r={}),r||(r={});var _=null;if(32!==(_=R.SigningKey.isSigningKey(e)?O.arrayify(e.privateKey):O.arrayify(e)).length)throw new Error("invalid private key");var n=L(t),M=null;if(r.entropy&&(M=O.arrayify(r.entropy)),r.mnemonic)if(M){if(g.entropyToMnemonic(M)!==r.mnemonic)throw new Error("entropy and mnemonic mismatch")}else M=O.arrayify(g.mnemonicToEntropy(r.mnemonic));var i=r.path;M&&!i&&(i=g.defaultPath);var A=r.client;A||(A="ethers.js");var E=null;E=r.salt?O.arrayify(r.salt):B.randomBytes(32);var S=null;if(r.iv){if(16!==(S=O.arrayify(r.iv)).length)throw new Error("invalid iv")}else S=B.randomBytes(16);var k=null;if(r.uuid){if(16!==(k=O.arrayify(r.uuid)).length)throw new Error("invalid uuid")}else k=B.randomBytes(16);var N=1<<17,P=8,x=1;return r.scrypt&&(r.scrypt.N&&(N=r.scrypt.N),r.scrypt.r&&(P=r.scrypt.r),r.scrypt.p&&(x=r.scrypt.p)),new Promise(function(g,b){w&&w(0),y.default(n,E,N,P,x,64,function(e,t,r){if(e)e.progress=t,b(e);else if(r){var n=(r=O.arrayify(r)).slice(0,16),i=r.slice(16,32),o=r.slice(32,64),s=new R.SigningKey(_).address,a=new I.default.Counter(S),u=new I.default.ModeOfOperation.ctr(n,a),l=O.arrayify(u.encrypt(_)),f=C.keccak256(O.concat([i,l])),h={address:s.substring(2).toLowerCase(),id:T.default.v4({random:k}),version:3,Crypto:{cipher:"aes-128-ctr",cipherparams:{iv:O.hexlify(S).substring(2)},ciphertext:O.hexlify(l).substring(2),kdf:"scrypt",kdfparams:{salt:O.hexlify(E).substring(2),n:N,dklen:32,p:x,r:P},mac:f.substring(2)}};if(M){var c=B.randomBytes(16),d=new I.default.Counter(c),p=new I.default.ModeOfOperation.ctr(o,d),v=O.arrayify(p.encrypt(M)),m=new Date,y=m.getUTCFullYear()+"-"+D(m.getUTCMonth()+1,2)+"-"+D(m.getUTCDate(),2)+"T"+D(m.getUTCHours(),2)+"-"+D(m.getUTCMinutes(),2)+"-"+D(m.getUTCSeconds(),2)+".0Z";h["x-ethers"]={client:A,gethFilename:"UTC--"+y+"--"+h.address,mnemonicCounter:O.hexlify(c).substring(2),mnemonicCiphertext:O.hexlify(v).substring(2),version:"0.1"}}w&&w(1),g(JSON.stringify(h))}else if(w)return w(t)})})}},{"./address":59,"./bytes":62,"./hdnode":64,"./keccak256":69,"./pbkdf2":71,"./random-bytes":73,"./signing-key":79,"./utf8":83,"aes-js":8,"scrypt-js":43,uuid:47}],77:[function(e,t,r){"use strict";var n=this&&this.__importDefault||function(e){return e&&e.__esModule?e:{default:e}};Object.defineProperty(r,"__esModule",{value:!0});var i=n(e("hash.js")),o=e("./bytes");r.sha256=function(e){return"0x"+i.default.sha256().update(o.arrayify(e)).digest("hex")},r.sha512=function(e){return"0x"+i.default.sha512().update(o.arrayify(e)).digest("hex")}},{"./bytes":62,"hash.js":27}],78:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0}),e("setimmediate"),r.platform="browser"},{setimmediate:44}],79:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=e("./hdnode"),o=e("./bytes"),s=e("./properties"),a=e("./secp256k1"),u=n(e("../errors")),l=function(){function n(e){u.checkNew(this,n);var t=null;i.HDNode.isHDNode(e)?(s.defineReadOnly(this,"mnemonic",e.mnemonic),s.defineReadOnly(this,"path",e.path),t=o.arrayify(e.privateKey)):("string"==typeof e&&e.match(/^[0-9a-f]*$/i)&&64===e.length&&(e="0x"+e),t=o.arrayify(e));try{32!==t.length&&u.throwError("exactly 32 bytes required",u.INVALID_ARGUMENT,{arg:"privateKey",value:"[REDACTED]"})}catch(e){var r={arg:"privateKey",reason:e.reason,value:"[REDACTED]"};e.value&&("number"==typeof e.value.length&&(r.length=e.value.length),r.type=typeof e.value),u.throwError("invalid private key",e.code,r)}s.defineReadOnly(this,"privateKey",o.hexlify(t)),s.defineReadOnly(this,"keyPair",new a.KeyPair(t)),s.defineReadOnly(this,"publicKey",this.keyPair.publicKey),s.defineReadOnly(this,"address",a.computeAddress(this.keyPair.publicKey)),s.setType(this,"SigningKey")}return n.prototype.signDigest=function(e){return this.keyPair.sign(e)},n.prototype.computeSharedSecret=function(e){return this.keyPair.computeSharedSecret(o.arrayify(e))},n.isSigningKey=function(e){return s.isType(e,"SigningKey")},n}();r.SigningKey=l},{"../errors":5,"./bytes":62,"./hdnode":64,"./properties":72,"./secp256k1":75}],80:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var u=e("./bignumber"),l=e("./bytes"),f=e("./utf8"),n=e("./keccak256"),i=e("./sha2"),h=new RegExp("^bytes([0-9]+)$"),c=new RegExp("^(u?int)([0-9]*)$"),d=new RegExp("^(.*)\\[([0-9]*)\\]$"),p="0000000000000000000000000000000000000000000000000000000000000000";function o(e,r){if(e.length!=r.length)throw new Error("type/value count mismatch");var n=[];return e.forEach(function(e,t){n.push(function t(e,r,n){switch(e){case"address":return n?l.padZeros(r,32):l.arrayify(r);case"string":return f.toUtf8Bytes(r);case"bytes":return l.arrayify(r);case"bool":return r=r?"0x01":"0x00",n?l.padZeros(r,32):l.arrayify(r)}var i=e.match(c);if(i){if((o=parseInt(i[2]||"256"))%8!=0||0===o||256<o)throw new Error("invalid number type - "+e);return n&&(o=256),r=u.bigNumberify(r).toTwos(o),l.padZeros(r,o/8)}if(i=e.match(h)){var o=parseInt(i[1]);if(String(o)!=i[1]||0===o||32<o)throw new Error("invalid number type - "+e);if(l.arrayify(r).byteLength!==o)throw new Error("invalid value for "+e);return n?l.arrayify((r+p).substring(0,66)):r}if((i=e.match(d))&&Array.isArray(r)){var s=i[1];if(parseInt(i[2]||String(r.length))!=r.length)throw new Error("invalid value for "+e);var a=[];return r.forEach(function(e){a.push(t(s,e,!0))}),l.concat(a)}throw new Error("unknown type - "+e)}(e,r[t]))}),l.hexlify(l.concat(n))}r.pack=o,r.keccak256=function(e,t){return n.keccak256(o(e,t))},r.sha256=function(e,t){return i.sha256(o(e,t))}},{"./bignumber":61,"./bytes":62,"./keccak256":69,"./sha2":77,"./utf8":83}],81:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i=e("../constants"),a=n(e("../errors")),u=e("./secp256k1"),l=e("./address"),f=e("./bignumber"),h=e("./bytes"),c=e("./keccak256"),s=e("./properties"),d=n(e("./rlp")),o=e("../providers/abstract-provider");function p(e){return"0x"===e?i.Zero:f.bigNumberify(e)}var v=[{name:"nonce",maxLength:32},{name:"gasPrice",maxLength:32},{name:"gasLimit",maxLength:32},{name:"to",length:20},{name:"value",maxLength:32},{name:"data"}],m={chainId:!0,data:!0,gasLimit:!0,gasPrice:!0,nonce:!0,to:!0,value:!0};r.serialize=function(r,e){s.checkProperties(r,m);var n=[];v.forEach(function(e){var t=r[e.name]||[];t=h.arrayify(h.hexlify(t)),e.length&&t.length!==e.length&&0<t.length&&a.throwError("invalid length for "+e.name,a.INVALID_ARGUMENT,{arg:"transaction"+e.name,value:t}),e.maxLength&&(t=h.stripZeros(t)).length>e.maxLength&&a.throwError("invalid length for "+e.name,a.INVALID_ARGUMENT,{arg:"transaction"+e.name,value:t}),n.push(h.hexlify(t))}),null!=r.chainId&&0!==r.chainId&&(n.push(h.hexlify(r.chainId)),n.push("0x"),n.push("0x"));var t=d.encode(n);if(!e)return t;var i=h.splitSignature(e),o=27+i.recoveryParam;return 9===n.length&&(n.pop(),n.pop(),n.pop(),o+=2*r.chainId+8),n.push(h.hexlify(o)),n.push(h.stripZeros(h.arrayify(i.r))),n.push(h.stripZeros(h.arrayify(i.s))),d.encode(n)},r.parse=function(e){var t=d.decode(e);9!==t.length&&6!==t.length&&a.throwError("invalid raw transaction",a.INVALID_ARGUMENT,{arg:"rawTransactin",value:e});var r,n={nonce:p(t[0]).toNumber(),gasPrice:p(t[1]),gasLimit:p(t[2]),to:(r=t[3],"0x"===r?null:l.getAddress(r)),value:p(t[4]),data:t[5],chainId:0};if(6===t.length)return n;try{n.v=f.bigNumberify(t[6]).toNumber()}catch(e){return console.log(e),n}if(n.r=h.hexZeroPad(t[7],32),n.s=h.hexZeroPad(t[8],32),f.bigNumberify(n.r).isZero()&&f.bigNumberify(n.s).isZero())n.chainId=n.v,n.v=0;else{n.chainId=Math.floor((n.v-35)/2),n.chainId<0&&(n.chainId=0);var i=n.v-27,o=t.slice(0,6);0!==n.chainId&&(o.push(h.hexlify(n.chainId)),o.push("0x"),o.push("0x"),i-=2*n.chainId+8);var s=c.keccak256(d.encode(o));try{n.from=u.recoverAddress(s,{r:h.hexlify(n.r),s:h.hexlify(n.s),recoveryParam:i})}catch(e){console.log(e)}n.hash=c.keccak256(e)}return n},r.populateTransaction=function(e,t,r){o.Provider.isProvider(t)||a.throwError("missing provider",a.INVALID_ARGUMENT,{argument:"provider",value:t}),s.checkProperties(e,m);var n=s.shallowCopy(e);if(null!=n.to&&(n.to=t.resolveName(n.to)),null==n.gasPrice&&(n.gasPrice=t.getGasPrice()),null==n.nonce&&(n.nonce=t.getTransactionCount(r)),null==n.gasLimit){var i=s.shallowCopy(n);i.from=r,n.gasLimit=t.estimateGas(i)}return null==n.chainId&&(n.chainId=t.getNetwork().then(function(e){return e.chainId})),s.resolveProperties(n)}},{"../constants":3,"../errors":5,"../providers/abstract-provider":49,"./address":59,"./bignumber":61,"./bytes":62,"./keccak256":69,"./properties":72,"./rlp":74,"./secp256k1":75}],82:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var i,f=e("../constants"),h=n(e("../errors")),c=e("./bignumber"),o={};function s(e){return{decimals:e.length-1,tenPower:c.bigNumberify(e)}}function d(e){var t=o[String(e).toLowerCase()];if(!t&&"number"==typeof e&&parseInt(String(e))==e&&0<=e&&e<=256){for(var r="1",n=0;n<e;n++)r+="0";t=s(r)}return t||h.throwError("invalid unitType",h.INVALID_ARGUMENT,{argument:"name",value:e}),t}function a(e,t){var r=d(t),n=(e=c.bigNumberify(e)).lt(f.Zero);n&&(e=e.mul(f.NegativeOne));for(var i=e.mod(r.tenPower).toString();i.length<r.decimals;)i="0"+i;return i=i.match(/^([0-9]*[1-9]|0)(0*)/)[1],e=e.div(r.tenPower).toString()+"."+i,n&&(e="-"+e),e}function u(e,t){null==t&&(t=18);var r=d(t);if("string"==typeof e&&e.match(/^-?[0-9.,]+$/)||h.throwError("invalid decimal value",h.INVALID_ARGUMENT,{arg:"value",value:e}),0===r.decimals)return c.bigNumberify(e);var n="-"===e.substring(0,1);n&&(e=e.substring(1)),"."===e&&h.throwError("missing value",h.INVALID_ARGUMENT,{arg:"value",value:e});var i=e.split(".");2<i.length&&h.throwError("too many decimal points",h.INVALID_ARGUMENT,{arg:"value",value:e});var o=i[0],s=i[1];for(o||(o="0"),s||(s="0"),s.length>r.decimals&&h.throwError("underflow occurred",h.NUMERIC_FAULT,{operation:"division",fault:"underflow"});s.length<r.decimals;)s+="0";var a=c.bigNumberify(o),u=c.bigNumberify(s),l=a.mul(r.tenPower).add(u);return n&&(l=l.mul(f.NegativeOne)),l}i="1",["wei","kwei","Mwei","Gwei","szabo","finney","ether"].forEach(function(e){var t=s(i);o[e.toLowerCase()]=t,o[String(t.decimals)]=t,i+="000"}),r.commify=function(e){var t=String(e).split(".");(2<t.length||!t[0].match(/^-?[0-9]*$/)||t[1]&&!t[1].match(/^[0-9]*$/)||"."===e||"-."===e)&&h.throwError("invalid value",h.INVALID_ARGUMENT,{argument:"value",value:e});var r=t[0],n="";for("-"===r.substring(0,1)&&(n="-",r=r.substring(1));"0"===r.substring(0,1);)r=r.substring(1);""===r&&(r="0");var i="";2===t.length&&(i="."+(t[1]||"0"));for(var o=[];r.length;){if(r.length<=3){o.unshift(r);break}var s=r.length-3;o.unshift(r.substring(s)),r=r.substring(0,s)}return n+o.join(",")+i},r.formatUnits=a,r.parseUnits=u,r.formatEther=function(e){return a(e,18)},r.parseEther=function(e){return u(e,18)}},{"../constants":3,"../errors":5,"./bignumber":61}],83:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var s,n,i=e("../constants"),a=e("../errors"),f=e("./bytes");function o(e,t){void 0===t&&(t=s.current),t!=s.current&&(a.checkNormalize(),e=e.normalize(t));for(var r=[],n=0;n<e.length;n++){var i=e.charCodeAt(n);if(i<128)r.push(i);else if(i<2048)r.push(i>>6|192),r.push(63&i|128);else if(55296==(64512&i)){n++;var o=e.charCodeAt(n);if(n>=e.length||56320!=(64512&o))throw new Error("invalid utf-8 string");i=65536+((1023&i)<<10)+(1023&o),r.push(i>>18|240),r.push(i>>12&63|128),r.push(i>>6&63|128),r.push(63&i|128)}else r.push(i>>12|224),r.push(i>>6&63|128),r.push(63&i|128)}return f.arrayify(r)}function u(e,t){e=f.arrayify(e);for(var r="",n=0;n<e.length;){var i=e[n++];if(i>>7!=0){var o=null,s=null;if(192==(224&i))o=1,s=127;else if(224==(240&i))o=2,s=2047;else{if(240!=(248&i)){if(!t){if(128==(192&i))throw new Error("invalid utf8 byte sequence; unexpected continuation byte");throw new Error("invalid utf8 byte sequence; invalid prefix")}continue}o=3,s=65535}if(n+o>e.length){if(!t)throw new Error("invalid utf8 byte sequence; too short");for(;n<e.length&&e[n]>>6==2;n++);}else{for(var a=i&(1<<8-o-1)-1,u=0;u<o;u++){var l=e[n];if(128!=(192&l)){a=null;break}a=a<<6|63&l,n++}if(null!==a)if(a<=s){if(!t)throw new Error("invalid utf8 byte sequence; overlong")}else if(1114111<a){if(!t)throw new Error("invalid utf8 byte sequence; out-of-range")}else if(55296<=a&&a<=57343){if(!t)throw new Error("invalid utf8 byte sequence; utf-16 surrogate")}else a<=65535?r+=String.fromCharCode(a):(a-=65536,r+=String.fromCharCode(55296+(a>>10&1023),56320+(1023&a)));else if(!t)throw new Error("invalid utf8 byte sequence; invalid continuation byte")}}else r+=String.fromCharCode(i)}return r}(n=s=r.UnicodeNormalizationForm||(r.UnicodeNormalizationForm={})).current="",n.NFC="NFC",n.NFD="NFD",n.NFKC="NFKC",n.NFKD="NFKD",r.toUtf8Bytes=o,r.toUtf8String=u,r.formatBytes32String=function(e){var t=o(e);if(31<t.length)throw new Error("bytes32 string must be less than 32 bytes");return f.hexlify(f.concat([t,i.HashZero]).slice(0,32))},r.parseBytes32String=function(e){var t=f.arrayify(e);if(32!==t.length)throw new Error("invalid bytes32 - not 32 bytes long");if(0!==t[31])throw new Error("invalid bytes32 sdtring - no null terminator");for(var r=31;0===t[r-1];)r--;return u(t.slice(0,r))}},{"../constants":3,"../errors":5,"./bytes":62}],84:[function(e,t,r){"use strict";var n=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var h=e("xmlhttprequest"),i=e("./base64"),o=e("./properties"),s=e("./utf8"),c=n(e("../errors"));r.fetchJson=function(e,a,u){var r={},l=null,f=12e4;if("string"==typeof e)l=e;else if("object"==typeof e){if(null==e.url&&c.throwError("missing URL",c.MISSING_ARGUMENT,{arg:"url"}),l=e.url,"number"==typeof e.timeout&&0<e.timeout&&(f=e.timeout),e.headers)for(var t in e.headers)r[t.toLowerCase()]={key:t,value:String(e.headers[t])};if(null!=e.user&&null!=e.password){"https:"!==l.substring(0,6)&&!0!==e.allowInsecure&&c.throwError("basic authentication requires a secure https url",c.INVALID_ARGUMENT,{arg:"url",url:l,user:e.user,password:"[REDACTED]"});var n=e.user+":"+e.password;r.authorization={key:"Authorization",value:"Basic "+i.encode(s.toUtf8Bytes(n))}}}return new Promise(function(n,i){var o=new h.XMLHttpRequest,e=null;e=setTimeout(function(){null!=e&&(e=null,i(new Error("timeout")),setTimeout(function(){o.abort()},0))},f);var s=function(){null!=e&&(clearTimeout(e),e=null)};a?(o.open("POST",l,!0),r["content-type"]={key:"Content-Type",value:"application/json"}):o.open("GET",l,!0),Object.keys(r).forEach(function(e){var t=r[e];o.setRequestHeader(t.key,t.value)}),o.onreadystatechange=function(){if(4===o.readyState){if(200!=o.status){s();var e=new Error("invalid response - "+o.status);return e.statusCode=o.status,o.responseText&&(e.responseText=o.responseText),void i(e)}var t=null;try{t=JSON.parse(o.responseText)}catch(e){s();var r=new Error("invalid json response");return r.orginialError=e,r.responseText=o.responseText,r.url=l,void i(r)}if(u)try{t=u(t)}catch(e){return s(),e.url=l,e.body=a,e.responseText=o.responseText,void i(e)}s(),n(t)}},o.onerror=function(e){s(),i(e)};try{a?o.send(a):o.send()}catch(e){s();var t=new Error("connection error");t.error=e,i(t)}})},r.poll=function(a,u){return u||(u={}),null==(u=o.shallowCopy(u)).floor&&(u.floor=0),null==u.ceiling&&(u.ceiling=1e4),null==u.interval&&(u.interval=250),new Promise(function(n,t){var e=null,i=!1,o=function(){return!i&&(i=!0,e&&clearTimeout(e),!0)};u.timeout&&(e=setTimeout(function(){o()&&t(new Error("timeout"))},u.timeout));var s=0;!function r(){return a().then(function(e){if(void 0!==e)o()&&n(e);else if(u.onceBlock)u.onceBlock.once("block",r);else if(!i){s++;var t=u.interval*parseInt(String(Math.random()*Math.pow(2,s)));t<u.floor&&(t=u.floor),t>u.ceiling&&(t=u.ceiling),setTimeout(r,t)}return null},function(e){o()&&t(e)})}()})}},{"../errors":5,"./base64":60,"./properties":72,"./utf8":83,xmlhttprequest:48}],85:[function(n,e,o){(function(e){"use strict";Object.defineProperty(o,"__esModule",{value:!0});var i=n("../utils/hash"),t=n("../utils/properties");o.check=function(e){for(var t=[],r=0;r<2048;r++){var n=e.getWord(r);if(r!==e.getWordIndex(n))return"0x";t.push(n)}return i.id(t.join("\n")+"\n")};var r=function(){function e(e){t.defineReadOnly(this,"locale",e)}return e.prototype.split=function(e){return e.toLowerCase().split(/ +/g)},e.prototype.join=function(e){return e.join(" ")},e}();o.Wordlist=r,o.register=function(e,t){t||(t=e.locale)}}).call(this,"undefined"!=typeof global?global:"undefined"!=typeof self?self:"undefined"!=typeof window?window:{})},{"../utils/hash":63,"../utils/properties":72}],86:[function(e,t,r){"use strict";var n,o=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)}),i=this&&this.__importStar||function(e){if(e&&e.__esModule)return e;var t={};if(null!=e)for(var r in e)Object.hasOwnProperty.call(e,r)&&(t[r]=e[r]);return t.default=e,t};Object.defineProperty(r,"__esModule",{value:!0});var s=e("./utils/bytes"),a=e("./utils/hash"),u=e("./utils/hdnode"),l=e("./utils/json-wallet"),f=e("./utils/keccak256"),h=e("./utils/properties"),c=e("./utils/random-bytes"),d=i(e("./utils/secret-storage")),p=e("./utils/signing-key"),v=e("./utils/transaction"),m=e("./abstract-signer"),y=e("./providers/abstract-provider"),g=i(e("./errors")),b=function(n){function i(e,t){var r=n.call(this)||this;return g.checkNew(r,i),p.SigningKey.isSigningKey(e)?h.defineReadOnly(r,"signingKey",e):h.defineReadOnly(r,"signingKey",new p.SigningKey(e)),h.defineReadOnly(r,"provider",t),r}return o(i,n),Object.defineProperty(i.prototype,"address",{get:function(){return this.signingKey.address},enumerable:!0,configurable:!0}),Object.defineProperty(i.prototype,"mnemonic",{get:function(){return this.signingKey.mnemonic},enumerable:!0,configurable:!0}),Object.defineProperty(i.prototype,"path",{get:function(){return this.signingKey.mnemonic},enumerable:!0,configurable:!0}),Object.defineProperty(i.prototype,"privateKey",{get:function(){return this.signingKey.privateKey},enumerable:!0,configurable:!0}),i.prototype.connect=function(e){return y.Provider.isProvider(e)||g.throwError("invalid provider",g.INVALID_ARGUMENT,{argument:"provider",value:e}),new i(this.signingKey,e)},i.prototype.getAddress=function(){return Promise.resolve(this.address)},i.prototype.sign=function(e){var n=this;return h.resolveProperties(e).then(function(e){var t=v.serialize(e),r=n.signingKey.signDigest(f.keccak256(t));return v.serialize(e,r)})},i.prototype.signMessage=function(e){return Promise.resolve(s.joinSignature(this.signingKey.signDigest(a.hashMessage(e))))},i.prototype.getBalance=function(e){if(!this.provider)throw new Error("missing provider");return this.provider.getBalance(this.address,e)},i.prototype.getTransactionCount=function(e){if(!this.provider)throw new Error("missing provider");return this.provider.getTransactionCount(this.address,e)},i.prototype.sendTransaction=function(e){var t=this;return v.populateTransaction(e,this.provider,this.address).then(function(e){return t.sign(e).then(function(e){return t.provider.sendTransaction(e)})})},i.prototype.encrypt=function(e,t,r){if("function"!=typeof t||r||(r=t,t={}),r&&"function"!=typeof r)throw new Error("invalid callback");return t||(t={}),this.mnemonic&&((t=h.shallowCopy(t)).mnemonic=this.mnemonic,t.path=this.path),d.encrypt(this.privateKey,e,t,r)},i.createRandom=function(e){var t=c.randomBytes(16);e||(e={}),e.extraEntropy&&(t=s.arrayify(f.keccak256(s.concat([t,e.extraEntropy])).substring(0,34)));var r=u.entropyToMnemonic(t,e.locale);return i.fromMnemonic(r,e.path,e.locale)},i.fromEncryptedJson=function(e,t,r){if(l.isCrowdsaleWallet(e))try{r&&r(0);var n=d.decryptCrowdsale(e,t);return r&&r(1),Promise.resolve(new i(n))}catch(e){return Promise.reject(e)}else if(l.isSecretStorageWallet(e))return d.decrypt(e,t,r).then(function(e){return new i(e)});return Promise.reject("invalid wallet JSON")},i.fromMnemonic=function(e,t,r){return t||(t=u.defaultPath),new i(u.fromMnemonic(e,r).derivePath(t))},i}(m.Signer);r.Wallet=b},{"./abstract-signer":2,"./errors":5,"./providers/abstract-provider":49,"./utils/bytes":62,"./utils/hash":63,"./utils/hdnode":64,"./utils/json-wallet":68,"./utils/keccak256":69,"./utils/properties":72,"./utils/random-bytes":73,"./utils/secret-storage":76,"./utils/signing-key":79,"./utils/transaction":81}],87:[function(e,t,r){"use strict";Object.defineProperty(r,"__esModule",{value:!0});var n=e("../wordlists/lang-en").langEn;r.en=n},{"../wordlists/lang-en":88}],88:[function(e,t,r){"use strict";var n,i=this&&this.__extends||(n=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var r in t)t.hasOwnProperty(r)&&(e[r]=t[r])},function(e,t){function r(){this.constructor=e}n(e,t),e.prototype=null===t?Object.create(t):(r.prototype=t.prototype,new r)});Object.defineProperty(r,"__esModule",{value:!0});var o=e("../utils/wordlist"),s="AbandonAbilityAbleAboutAboveAbsentAbsorbAbstractAbsurdAbuseAccessAccidentAccountAccuseAchieveAcidAcousticAcquireAcrossActActionActorActressActualAdaptAddAddictAddressAdjustAdmitAdultAdvanceAdviceAerobicAffairAffordAfraidAgainAgeAgentAgreeAheadAimAirAirportAisleAlarmAlbumAlcoholAlertAlienAllAlleyAllowAlmostAloneAlphaAlreadyAlsoAlterAlwaysAmateurAmazingAmongAmountAmusedAnalystAnchorAncientAngerAngleAngryAnimalAnkleAnnounceAnnualAnotherAnswerAntennaAntiqueAnxietyAnyApartApologyAppearAppleApproveAprilArchArcticAreaArenaArgueArmArmedArmorArmyAroundArrangeArrestArriveArrowArtArtefactArtistArtworkAskAspectAssaultAssetAssistAssumeAsthmaAthleteAtomAttackAttendAttitudeAttractAuctionAuditAugustAuntAuthorAutoAutumnAverageAvocadoAvoidAwakeAwareAwayAwesomeAwfulAwkwardAxisBabyBachelorBaconBadgeBagBalanceBalconyBallBambooBananaBannerBarBarelyBargainBarrelBaseBasicBasketBattleBeachBeanBeautyBecauseBecomeBeefBeforeBeginBehaveBehindBelieveBelowBeltBenchBenefitBestBetrayBetterBetweenBeyondBicycleBidBikeBindBiologyBirdBirthBitterBlackBladeBlameBlanketBlastBleakBlessBlindBloodBlossomBlouseBlueBlurBlushBoardBoatBodyBoilBombBoneBonusBookBoostBorderBoringBorrowBossBottomBounceBoxBoyBracketBrainBrandBrassBraveBreadBreezeBrickBridgeBriefBrightBringBriskBroccoliBrokenBronzeBroomBrotherBrownBrushBubbleBuddyBudgetBuffaloBuildBulbBulkBulletBundleBunkerBurdenBurgerBurstBusBusinessBusyButterBuyerBuzzCabbageCabinCableCactusCageCakeCallCalmCameraCampCanCanalCancelCandyCannonCanoeCanvasCanyonCapableCapitalCaptainCarCarbonCardCargoCarpetCarryCartCaseCashCasinoCastleCasualCatCatalogCatchCategoryCattleCaughtCauseCautionCaveCeilingCeleryCementCensusCenturyCerealCertainChairChalkChampionChangeChaosChapterChargeChaseChatCheapCheckCheeseChefCherryChestChickenChiefChildChimneyChoiceChooseChronicChuckleChunkChurnCigarCinnamonCircleCitizenCityCivilClaimClapClarifyClawClayCleanClerkCleverClickClientCliffClimbClinicClipClockClogCloseClothCloudClownClubClumpClusterClutchCoachCoastCoconutCodeCoffeeCoilCoinCollectColorColumnCombineComeComfortComicCommonCompanyConcertConductConfirmCongressConnectConsiderControlConvinceCookCoolCopperCopyCoralCoreCornCorrectCostCottonCouchCountryCoupleCourseCousinCoverCoyoteCrackCradleCraftCramCraneCrashCraterCrawlCrazyCreamCreditCreekCrewCricketCrimeCrispCriticCropCrossCrouchCrowdCrucialCruelCruiseCrumbleCrunchCrushCryCrystalCubeCultureCupCupboardCuriousCurrentCurtainCurveCushionCustomCuteCycleDadDamageDampDanceDangerDaringDashDaughterDawnDayDealDebateDebrisDecadeDecemberDecideDeclineDecorateDecreaseDeerDefenseDefineDefyDegreeDelayDeliverDemandDemiseDenialDentistDenyDepartDependDepositDepthDeputyDeriveDescribeDesertDesignDeskDespairDestroyDetailDetectDevelopDeviceDevoteDiagramDialDiamondDiaryDiceDieselDietDifferDigitalDignityDilemmaDinnerDinosaurDirectDirtDisagreeDiscoverDiseaseDishDismissDisorderDisplayDistanceDivertDivideDivorceDizzyDoctorDocumentDogDollDolphinDomainDonateDonkeyDonorDoorDoseDoubleDoveDraftDragonDramaDrasticDrawDreamDressDriftDrillDrinkDripDriveDropDrumDryDuckDumbDuneDuringDustDutchDutyDwarfDynamicEagerEagleEarlyEarnEarthEasilyEastEasyEchoEcologyEconomyEdgeEditEducateEffortEggEightEitherElbowElderElectricElegantElementElephantElevatorEliteElseEmbarkEmbodyEmbraceEmergeEmotionEmployEmpowerEmptyEnableEnactEndEndlessEndorseEnemyEnergyEnforceEngageEngineEnhanceEnjoyEnlistEnoughEnrichEnrollEnsureEnterEntireEntryEnvelopeEpisodeEqualEquipEraEraseErodeErosionErrorEruptEscapeEssayEssenceEstateEternalEthicsEvidenceEvilEvokeEvolveExactExampleExcessExchangeExciteExcludeExcuseExecuteExerciseExhaustExhibitExileExistExitExoticExpandExpectExpireExplainExposeExpressExtendExtraEyeEyebrowFabricFaceFacultyFadeFaintFaithFallFalseFameFamilyFamousFanFancyFantasyFarmFashionFatFatalFatherFatigueFaultFavoriteFeatureFebruaryFederalFeeFeedFeelFemaleFenceFestivalFetchFeverFewFiberFictionFieldFigureFileFilmFilterFinalFindFineFingerFinishFireFirmFirstFiscalFishFitFitnessFixFlagFlameFlashFlatFlavorFleeFlightFlipFloatFlockFloorFlowerFluidFlushFlyFoamFocusFogFoilFoldFollowFoodFootForceForestForgetForkFortuneForumForwardFossilFosterFoundFoxFragileFrameFrequentFreshFriendFringeFrogFrontFrostFrownFrozenFruitFuelFunFunnyFurnaceFuryFutureGadgetGainGalaxyGalleryGameGapGarageGarbageGardenGarlicGarmentGasGaspGateGatherGaugeGazeGeneralGeniusGenreGentleGenuineGestureGhostGiantGiftGiggleGingerGiraffeGirlGiveGladGlanceGlareGlassGlideGlimpseGlobeGloomGloryGloveGlowGlueGoatGoddessGoldGoodGooseGorillaGospelGossipGovernGownGrabGraceGrainGrantGrapeGrassGravityGreatGreenGridGriefGritGroceryGroupGrowGruntGuardGuessGuideGuiltGuitarGunGymHabitHairHalfHammerHamsterHandHappyHarborHardHarshHarvestHatHaveHawkHazardHeadHealthHeartHeavyHedgehogHeightHelloHelmetHelpHenHeroHiddenHighHillHintHipHireHistoryHobbyHockeyHoldHoleHolidayHollowHomeHoneyHoodHopeHornHorrorHorseHospitalHostHotelHourHoverHubHugeHumanHumbleHumorHundredHungryHuntHurdleHurryHurtHusbandHybridIceIconIdeaIdentifyIdleIgnoreIllIllegalIllnessImageImitateImmenseImmuneImpactImposeImproveImpulseInchIncludeIncomeIncreaseIndexIndicateIndoorIndustryInfantInflictInformInhaleInheritInitialInjectInjuryInmateInnerInnocentInputInquiryInsaneInsectInsideInspireInstallIntactInterestIntoInvestInviteInvolveIronIslandIsolateIssueItemIvoryJacketJaguarJarJazzJealousJeansJellyJewelJobJoinJokeJourneyJoyJudgeJuiceJumpJungleJuniorJunkJustKangarooKeenKeepKetchupKeyKickKidKidneyKindKingdomKissKitKitchenKiteKittenKiwiKneeKnifeKnockKnowLabLabelLaborLadderLadyLakeLampLanguageLaptopLargeLaterLatinLaughLaundryLavaLawLawnLawsuitLayerLazyLeaderLeafLearnLeaveLectureLeftLegLegalLegendLeisureLemonLendLengthLensLeopardLessonLetterLevelLiarLibertyLibraryLicenseLifeLiftLightLikeLimbLimitLinkLionLiquidListLittleLiveLizardLoadLoanLobsterLocalLockLogicLonelyLongLoopLotteryLoudLoungeLoveLoyalLuckyLuggageLumberLunarLunchLuxuryLyricsMachineMadMagicMagnetMaidMailMainMajorMakeMammalManManageMandateMangoMansionManualMapleMarbleMarchMarginMarineMarketMarriageMaskMassMasterMatchMaterialMathMatrixMatterMaximumMazeMeadowMeanMeasureMeatMechanicMedalMediaMelodyMeltMemberMemoryMentionMenuMercyMergeMeritMerryMeshMessageMetalMethodMiddleMidnightMilkMillionMimicMindMinimumMinorMinuteMiracleMirrorMiseryMissMistakeMixMixedMixtureMobileModelModifyMomMomentMonitorMonkeyMonsterMonthMoonMoralMoreMorningMosquitoMotherMotionMotorMountainMouseMoveMovieMuchMuffinMuleMultiplyMuscleMuseumMushroomMusicMustMutualMyselfMysteryMythNaiveNameNapkinNarrowNastyNationNatureNearNeckNeedNegativeNeglectNeitherNephewNerveNestNetNetworkNeutralNeverNewsNextNiceNightNobleNoiseNomineeNoodleNormalNorthNoseNotableNoteNothingNoticeNovelNowNuclearNumberNurseNutOakObeyObjectObligeObscureObserveObtainObviousOccurOceanOctoberOdorOffOfferOfficeOftenOilOkayOldOliveOlympicOmitOnceOneOnionOnlineOnlyOpenOperaOpinionOpposeOptionOrangeOrbitOrchardOrderOrdinaryOrganOrientOriginalOrphanOstrichOtherOutdoorOuterOutputOutsideOvalOvenOverOwnOwnerOxygenOysterOzonePactPaddlePagePairPalacePalmPandaPanelPanicPantherPaperParadeParentParkParrotPartyPassPatchPathPatientPatrolPatternPausePavePaymentPeacePeanutPearPeasantPelicanPenPenaltyPencilPeoplePepperPerfectPermitPersonPetPhonePhotoPhrasePhysicalPianoPicnicPicturePiecePigPigeonPillPilotPinkPioneerPipePistolPitchPizzaPlacePlanetPlasticPlatePlayPleasePledgePluckPlugPlungePoemPoetPointPolarPolePolicePondPonyPoolPopularPortionPositionPossiblePostPotatoPotteryPovertyPowderPowerPracticePraisePredictPreferPreparePresentPrettyPreventPricePridePrimaryPrintPriorityPrisonPrivatePrizeProblemProcessProduceProfitProgramProjectPromoteProofPropertyProsperProtectProudProvidePublicPuddingPullPulpPulsePumpkinPunchPupilPuppyPurchasePurityPurposePursePushPutPuzzlePyramidQualityQuantumQuarterQuestionQuickQuitQuizQuoteRabbitRaccoonRaceRackRadarRadioRailRainRaiseRallyRampRanchRandomRangeRapidRareRateRatherRavenRawRazorReadyRealReasonRebelRebuildRecallReceiveRecipeRecordRecycleReduceReflectReformRefuseRegionRegretRegularRejectRelaxReleaseReliefRelyRemainRememberRemindRemoveRenderRenewRentReopenRepairRepeatReplaceReportRequireRescueResembleResistResourceResponseResultRetireRetreatReturnReunionRevealReviewRewardRhythmRibRibbonRiceRichRideRidgeRifleRightRigidRingRiotRippleRiskRitualRivalRiverRoadRoastRobotRobustRocketRomanceRoofRookieRoomRoseRotateRoughRoundRouteRoyalRubberRudeRugRuleRunRunwayRuralSadSaddleSadnessSafeSailSaladSalmonSalonSaltSaluteSameSampleSandSatisfySatoshiSauceSausageSaveSayScaleScanScareScatterSceneSchemeSchoolScienceScissorsScorpionScoutScrapScreenScriptScrubSeaSearchSeasonSeatSecondSecretSectionSecuritySeedSeekSegmentSelectSellSeminarSeniorSenseSentenceSeriesServiceSessionSettleSetupSevenShadowShaftShallowShareShedShellSheriffShieldShiftShineShipShiverShockShoeShootShopShortShoulderShoveShrimpShrugShuffleShySiblingSickSideSiegeSightSignSilentSilkSillySilverSimilarSimpleSinceSingSirenSisterSituateSixSizeSkateSketchSkiSkillSkinSkirtSkullSlabSlamSleepSlenderSliceSlideSlightSlimSloganSlotSlowSlushSmallSmartSmileSmokeSmoothSnackSnakeSnapSniffSnowSoapSoccerSocialSockSodaSoftSolarSoldierSolidSolutionSolveSomeoneSongSoonSorrySortSoulSoundSoupSourceSouthSpaceSpareSpatialSpawnSpeakSpecialSpeedSpellSpendSphereSpiceSpiderSpikeSpinSpiritSplitSpoilSponsorSpoonSportSpotSpraySpreadSpringSpySquareSqueezeSquirrelStableStadiumStaffStageStairsStampStandStartStateStaySteakSteelStemStepStereoStickStillStingStockStomachStoneStoolStoryStoveStrategyStreetStrikeStrongStruggleStudentStuffStumbleStyleSubjectSubmitSubwaySuccessSuchSuddenSufferSugarSuggestSuitSummerSunSunnySunsetSuperSupplySupremeSureSurfaceSurgeSurpriseSurroundSurveySuspectSustainSwallowSwampSwapSwarmSwearSweetSwiftSwimSwingSwitchSwordSymbolSymptomSyrupSystemTableTackleTagTailTalentTalkTankTapeTargetTaskTasteTattooTaxiTeachTeamTellTenTenantTennisTentTermTestTextThankThatThemeThenTheoryThereTheyThingThisThoughtThreeThriveThrowThumbThunderTicketTideTigerTiltTimberTimeTinyTipTiredTissueTitleToastTobaccoTodayToddlerToeTogetherToiletTokenTomatoTomorrowToneTongueTonightToolToothTopTopicToppleTorchTornadoTortoiseTossTotalTouristTowardTowerTownToyTrackTradeTrafficTragicTrainTransferTrapTrashTravelTrayTreatTreeTrendTrialTribeTrickTriggerTrimTripTrophyTroubleTruckTrueTrulyTrumpetTrustTruthTryTubeTuitionTumbleTunaTunnelTurkeyTurnTurtleTwelveTwentyTwiceTwinTwistTwoTypeTypicalUglyUmbrellaUnableUnawareUncleUncoverUnderUndoUnfairUnfoldUnhappyUniformUniqueUnitUniverseUnknownUnlockUntilUnusualUnveilUpdateUpgradeUpholdUponUpperUpsetUrbanUrgeUsageUseUsedUsefulUselessUsualUtilityVacantVacuumVagueValidValleyValveVanVanishVaporVariousVastVaultVehicleVelvetVendorVentureVenueVerbVerifyVersionVeryVesselVeteranViableVibrantViciousVictoryVideoViewVillageVintageViolinVirtualVirusVisaVisitVisualVitalVividVocalVoiceVoidVolcanoVolumeVoteVoyageWageWagonWaitWalkWallWalnutWantWarfareWarmWarriorWashWaspWasteWaterWaveWayWealthWeaponWearWeaselWeatherWebWeddingWeekendWeirdWelcomeWestWetWhaleWhatWheatWheelWhenWhereWhipWhisperWideWidthWifeWildWillWinWindowWineWingWinkWinnerWinterWireWisdomWiseWishWitnessWolfWomanWonderWoodWoolWordWorkWorldWorryWorthWrapWreckWrestleWristWriteWrongYardYearYellowYouYoungYouthZebraZeroZoneZoo",a=null;function u(e){if(null==a&&(a=s.replace(/([A-Z])/g," $1").toLowerCase().substring(1).split(" "),"0x3c8acc1e7b08d8e76f9fda015ef48dc8c710a73cb7e0f77b2c18a9b5a7adde60"!==o.check(e)))throw a=null,new Error("BIP39 Wordlist for en (English) FAILED")}var l=new(function(e){function t(){return e.call(this,"en")||this}return i(t,e),t.prototype.getWord=function(e){return u(this),a[e]},t.prototype.getWordIndex=function(e){return u(this),a.indexOf(e)},t}(o.Wordlist));r.langEn=l,o.register(l)},{"../utils/wordlist":85}]},{},[7])(7)});


}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],34:[function(require,module,exports){
var hash = exports;

hash.utils = require('./hash/utils');
hash.common = require('./hash/common');
hash.sha = require('./hash/sha');
hash.ripemd = require('./hash/ripemd');
hash.hmac = require('./hash/hmac');

// Proxy hash functions to the main object
hash.sha1 = hash.sha.sha1;
hash.sha256 = hash.sha.sha256;
hash.sha224 = hash.sha.sha224;
hash.sha384 = hash.sha.sha384;
hash.sha512 = hash.sha.sha512;
hash.ripemd160 = hash.ripemd.ripemd160;

},{"./hash/common":35,"./hash/hmac":36,"./hash/ripemd":37,"./hash/sha":38,"./hash/utils":45}],35:[function(require,module,exports){
'use strict';

var utils = require('./utils');
var assert = require('minimalistic-assert');

function BlockHash() {
  this.pending = null;
  this.pendingTotal = 0;
  this.blockSize = this.constructor.blockSize;
  this.outSize = this.constructor.outSize;
  this.hmacStrength = this.constructor.hmacStrength;
  this.padLength = this.constructor.padLength / 8;
  this.endian = 'big';

  this._delta8 = this.blockSize / 8;
  this._delta32 = this.blockSize / 32;
}
exports.BlockHash = BlockHash;

BlockHash.prototype.update = function update(msg, enc) {
  // Convert message to array, pad it, and join into 32bit blocks
  msg = utils.toArray(msg, enc);
  if (!this.pending)
    this.pending = msg;
  else
    this.pending = this.pending.concat(msg);
  this.pendingTotal += msg.length;

  // Enough data, try updating
  if (this.pending.length >= this._delta8) {
    msg = this.pending;

    // Process pending data in blocks
    var r = msg.length % this._delta8;
    this.pending = msg.slice(msg.length - r, msg.length);
    if (this.pending.length === 0)
      this.pending = null;

    msg = utils.join32(msg, 0, msg.length - r, this.endian);
    for (var i = 0; i < msg.length; i += this._delta32)
      this._update(msg, i, i + this._delta32);
  }

  return this;
};

BlockHash.prototype.digest = function digest(enc) {
  this.update(this._pad());
  assert(this.pending === null);

  return this._digest(enc);
};

BlockHash.prototype._pad = function pad() {
  var len = this.pendingTotal;
  var bytes = this._delta8;
  var k = bytes - ((len + this.padLength) % bytes);
  var res = new Array(k + this.padLength);
  res[0] = 0x80;
  for (var i = 1; i < k; i++)
    res[i] = 0;

  // Append length
  len <<= 3;
  if (this.endian === 'big') {
    for (var t = 8; t < this.padLength; t++)
      res[i++] = 0;

    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = (len >>> 24) & 0xff;
    res[i++] = (len >>> 16) & 0xff;
    res[i++] = (len >>> 8) & 0xff;
    res[i++] = len & 0xff;
  } else {
    res[i++] = len & 0xff;
    res[i++] = (len >>> 8) & 0xff;
    res[i++] = (len >>> 16) & 0xff;
    res[i++] = (len >>> 24) & 0xff;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;
    res[i++] = 0;

    for (t = 8; t < this.padLength; t++)
      res[i++] = 0;
  }

  return res;
};

},{"./utils":45,"minimalistic-assert":48}],36:[function(require,module,exports){
module.exports = {};
},{}],37:[function(require,module,exports){
module.exports = { ripemd160: null }
},{}],38:[function(require,module,exports){
'use strict';

exports.sha1 = require('./sha/1');
exports.sha224 = require('./sha/224');
exports.sha256 = require('./sha/256');
exports.sha384 = require('./sha/384');
exports.sha512 = require('./sha/512');

},{"./sha/1":39,"./sha/224":40,"./sha/256":41,"./sha/384":42,"./sha/512":43}],39:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36}],40:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36}],41:[function(require,module,exports){
'use strict';

var utils = require('../utils');
var common = require('../common');
var shaCommon = require('./common');
var assert = require('minimalistic-assert');

var sum32 = utils.sum32;
var sum32_4 = utils.sum32_4;
var sum32_5 = utils.sum32_5;
var ch32 = shaCommon.ch32;
var maj32 = shaCommon.maj32;
var s0_256 = shaCommon.s0_256;
var s1_256 = shaCommon.s1_256;
var g0_256 = shaCommon.g0_256;
var g1_256 = shaCommon.g1_256;

var BlockHash = common.BlockHash;

var sha256_K = [
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
];

function SHA256() {
  if (!(this instanceof SHA256))
    return new SHA256();

  BlockHash.call(this);
  this.h = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];
  this.k = sha256_K;
  this.W = new Array(64);
}
utils.inherits(SHA256, BlockHash);
module.exports = SHA256;

SHA256.blockSize = 512;
SHA256.outSize = 256;
SHA256.hmacStrength = 192;
SHA256.padLength = 64;

SHA256.prototype._update = function _update(msg, start) {
  var W = this.W;

  for (var i = 0; i < 16; i++)
    W[i] = msg[start + i];
  for (; i < W.length; i++)
    W[i] = sum32_4(g1_256(W[i - 2]), W[i - 7], g0_256(W[i - 15]), W[i - 16]);

  var a = this.h[0];
  var b = this.h[1];
  var c = this.h[2];
  var d = this.h[3];
  var e = this.h[4];
  var f = this.h[5];
  var g = this.h[6];
  var h = this.h[7];

  assert(this.k.length === W.length);
  for (i = 0; i < W.length; i++) {
    var T1 = sum32_5(h, s1_256(e), ch32(e, f, g), this.k[i], W[i]);
    var T2 = sum32(s0_256(a), maj32(a, b, c));
    h = g;
    g = f;
    f = e;
    e = sum32(d, T1);
    d = c;
    c = b;
    b = a;
    a = sum32(T1, T2);
  }

  this.h[0] = sum32(this.h[0], a);
  this.h[1] = sum32(this.h[1], b);
  this.h[2] = sum32(this.h[2], c);
  this.h[3] = sum32(this.h[3], d);
  this.h[4] = sum32(this.h[4], e);
  this.h[5] = sum32(this.h[5], f);
  this.h[6] = sum32(this.h[6], g);
  this.h[7] = sum32(this.h[7], h);
};

SHA256.prototype._digest = function digest(enc) {
  if (enc === 'hex')
    return utils.toHex32(this.h, 'big');
  else
    return utils.split32(this.h, 'big');
};

},{"../common":35,"../utils":45,"./common":44,"minimalistic-assert":48}],42:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36}],43:[function(require,module,exports){
arguments[4][36][0].apply(exports,arguments)
},{"dup":36}],44:[function(require,module,exports){
'use strict';

var utils = require('../utils');
var rotr32 = utils.rotr32;

function ft_1(s, x, y, z) {
  if (s === 0)
    return ch32(x, y, z);
  if (s === 1 || s === 3)
    return p32(x, y, z);
  if (s === 2)
    return maj32(x, y, z);
}
exports.ft_1 = ft_1;

function ch32(x, y, z) {
  return (x & y) ^ ((~x) & z);
}
exports.ch32 = ch32;

function maj32(x, y, z) {
  return (x & y) ^ (x & z) ^ (y & z);
}
exports.maj32 = maj32;

function p32(x, y, z) {
  return x ^ y ^ z;
}
exports.p32 = p32;

function s0_256(x) {
  return rotr32(x, 2) ^ rotr32(x, 13) ^ rotr32(x, 22);
}
exports.s0_256 = s0_256;

function s1_256(x) {
  return rotr32(x, 6) ^ rotr32(x, 11) ^ rotr32(x, 25);
}
exports.s1_256 = s1_256;

function g0_256(x) {
  return rotr32(x, 7) ^ rotr32(x, 18) ^ (x >>> 3);
}
exports.g0_256 = g0_256;

function g1_256(x) {
  return rotr32(x, 17) ^ rotr32(x, 19) ^ (x >>> 10);
}
exports.g1_256 = g1_256;

},{"../utils":45}],45:[function(require,module,exports){
'use strict';

var assert = require('minimalistic-assert');
var inherits = require('inherits');

exports.inherits = inherits;

function toArray(msg, enc) {
  if (Array.isArray(msg))
    return msg.slice();
  if (!msg)
    return [];
  var res = [];
  if (typeof msg === 'string') {
    if (!enc) {
      for (var i = 0; i < msg.length; i++) {
        var c = msg.charCodeAt(i);
        var hi = c >> 8;
        var lo = c & 0xff;
        if (hi)
          res.push(hi, lo);
        else
          res.push(lo);
      }
    } else if (enc === 'hex') {
      msg = msg.replace(/[^a-z0-9]+/ig, '');
      if (msg.length % 2 !== 0)
        msg = '0' + msg;
      for (i = 0; i < msg.length; i += 2)
        res.push(parseInt(msg[i] + msg[i + 1], 16));
    }
  } else {
    for (i = 0; i < msg.length; i++)
      res[i] = msg[i] | 0;
  }
  return res;
}
exports.toArray = toArray;

function toHex(msg) {
  var res = '';
  for (var i = 0; i < msg.length; i++)
    res += zero2(msg[i].toString(16));
  return res;
}
exports.toHex = toHex;

function htonl(w) {
  var res = (w >>> 24) |
            ((w >>> 8) & 0xff00) |
            ((w << 8) & 0xff0000) |
            ((w & 0xff) << 24);
  return res >>> 0;
}
exports.htonl = htonl;

function toHex32(msg, endian) {
  var res = '';
  for (var i = 0; i < msg.length; i++) {
    var w = msg[i];
    if (endian === 'little')
      w = htonl(w);
    res += zero8(w.toString(16));
  }
  return res;
}
exports.toHex32 = toHex32;

function zero2(word) {
  if (word.length === 1)
    return '0' + word;
  else
    return word;
}
exports.zero2 = zero2;

function zero8(word) {
  if (word.length === 7)
    return '0' + word;
  else if (word.length === 6)
    return '00' + word;
  else if (word.length === 5)
    return '000' + word;
  else if (word.length === 4)
    return '0000' + word;
  else if (word.length === 3)
    return '00000' + word;
  else if (word.length === 2)
    return '000000' + word;
  else if (word.length === 1)
    return '0000000' + word;
  else
    return word;
}
exports.zero8 = zero8;

function join32(msg, start, end, endian) {
  var len = end - start;
  assert(len % 4 === 0);
  var res = new Array(len / 4);
  for (var i = 0, k = start; i < res.length; i++, k += 4) {
    var w;
    if (endian === 'big')
      w = (msg[k] << 24) | (msg[k + 1] << 16) | (msg[k + 2] << 8) | msg[k + 3];
    else
      w = (msg[k + 3] << 24) | (msg[k + 2] << 16) | (msg[k + 1] << 8) | msg[k];
    res[i] = w >>> 0;
  }
  return res;
}
exports.join32 = join32;

function split32(msg, endian) {
  var res = new Array(msg.length * 4);
  for (var i = 0, k = 0; i < msg.length; i++, k += 4) {
    var m = msg[i];
    if (endian === 'big') {
      res[k] = m >>> 24;
      res[k + 1] = (m >>> 16) & 0xff;
      res[k + 2] = (m >>> 8) & 0xff;
      res[k + 3] = m & 0xff;
    } else {
      res[k + 3] = m >>> 24;
      res[k + 2] = (m >>> 16) & 0xff;
      res[k + 1] = (m >>> 8) & 0xff;
      res[k] = m & 0xff;
    }
  }
  return res;
}
exports.split32 = split32;

function rotr32(w, b) {
  return (w >>> b) | (w << (32 - b));
}
exports.rotr32 = rotr32;

function rotl32(w, b) {
  return (w << b) | (w >>> (32 - b));
}
exports.rotl32 = rotl32;

function sum32(a, b) {
  return (a + b) >>> 0;
}
exports.sum32 = sum32;

function sum32_3(a, b, c) {
  return (a + b + c) >>> 0;
}
exports.sum32_3 = sum32_3;

function sum32_4(a, b, c, d) {
  return (a + b + c + d) >>> 0;
}
exports.sum32_4 = sum32_4;

function sum32_5(a, b, c, d, e) {
  return (a + b + c + d + e) >>> 0;
}
exports.sum32_5 = sum32_5;

function sum64(buf, pos, ah, al) {
  var bh = buf[pos];
  var bl = buf[pos + 1];

  var lo = (al + bl) >>> 0;
  var hi = (lo < al ? 1 : 0) + ah + bh;
  buf[pos] = hi >>> 0;
  buf[pos + 1] = lo;
}
exports.sum64 = sum64;

function sum64_hi(ah, al, bh, bl) {
  var lo = (al + bl) >>> 0;
  var hi = (lo < al ? 1 : 0) + ah + bh;
  return hi >>> 0;
}
exports.sum64_hi = sum64_hi;

function sum64_lo(ah, al, bh, bl) {
  var lo = al + bl;
  return lo >>> 0;
}
exports.sum64_lo = sum64_lo;

function sum64_4_hi(ah, al, bh, bl, ch, cl, dh, dl) {
  var carry = 0;
  var lo = al;
  lo = (lo + bl) >>> 0;
  carry += lo < al ? 1 : 0;
  lo = (lo + cl) >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = (lo + dl) >>> 0;
  carry += lo < dl ? 1 : 0;

  var hi = ah + bh + ch + dh + carry;
  return hi >>> 0;
}
exports.sum64_4_hi = sum64_4_hi;

function sum64_4_lo(ah, al, bh, bl, ch, cl, dh, dl) {
  var lo = al + bl + cl + dl;
  return lo >>> 0;
}
exports.sum64_4_lo = sum64_4_lo;

function sum64_5_hi(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  var carry = 0;
  var lo = al;
  lo = (lo + bl) >>> 0;
  carry += lo < al ? 1 : 0;
  lo = (lo + cl) >>> 0;
  carry += lo < cl ? 1 : 0;
  lo = (lo + dl) >>> 0;
  carry += lo < dl ? 1 : 0;
  lo = (lo + el) >>> 0;
  carry += lo < el ? 1 : 0;

  var hi = ah + bh + ch + dh + eh + carry;
  return hi >>> 0;
}
exports.sum64_5_hi = sum64_5_hi;

function sum64_5_lo(ah, al, bh, bl, ch, cl, dh, dl, eh, el) {
  var lo = al + bl + cl + dl + el;

  return lo >>> 0;
}
exports.sum64_5_lo = sum64_5_lo;

function rotr64_hi(ah, al, num) {
  var r = (al << (32 - num)) | (ah >>> num);
  return r >>> 0;
}
exports.rotr64_hi = rotr64_hi;

function rotr64_lo(ah, al, num) {
  var r = (ah << (32 - num)) | (al >>> num);
  return r >>> 0;
}
exports.rotr64_lo = rotr64_lo;

function shr64_hi(ah, al, num) {
  return ah >>> num;
}
exports.shr64_hi = shr64_hi;

function shr64_lo(ah, al, num) {
  var r = (ah << (32 - num)) | (al >>> num);
  return r >>> 0;
}
exports.shr64_lo = shr64_lo;

},{"inherits":46,"minimalistic-assert":48}],46:[function(require,module,exports){
arguments[4][11][0].apply(exports,arguments)
},{"dup":11}],47:[function(require,module,exports){
(function (process,global){
/**
 * [js-sha3]{@link https://github.com/emn178/js-sha3}
 *
 * @version 0.5.7
 * @author Chen, Yi-Cyuan [emn178@gmail.com]
 * @copyright Chen, Yi-Cyuan 2015-2016
 * @license MIT
 */
/*jslint bitwise: true */
(function () {
  'use strict';

  var root = typeof window === 'object' ? window : {};
  var NODE_JS = !root.JS_SHA3_NO_NODE_JS && typeof process === 'object' && process.versions && process.versions.node;
  if (NODE_JS) {
    root = global;
  }
  var COMMON_JS = !root.JS_SHA3_NO_COMMON_JS && typeof module === 'object' && module.exports;
  var HEX_CHARS = '0123456789abcdef'.split('');
  var SHAKE_PADDING = [31, 7936, 2031616, 520093696];
  var KECCAK_PADDING = [1, 256, 65536, 16777216];
  var PADDING = [6, 1536, 393216, 100663296];
  var SHIFT = [0, 8, 16, 24];
  var RC = [1, 0, 32898, 0, 32906, 2147483648, 2147516416, 2147483648, 32907, 0, 2147483649,
            0, 2147516545, 2147483648, 32777, 2147483648, 138, 0, 136, 0, 2147516425, 0,
            2147483658, 0, 2147516555, 0, 139, 2147483648, 32905, 2147483648, 32771,
            2147483648, 32770, 2147483648, 128, 2147483648, 32778, 0, 2147483658, 2147483648,
            2147516545, 2147483648, 32896, 2147483648, 2147483649, 0, 2147516424, 2147483648];
  var BITS = [224, 256, 384, 512];
  var SHAKE_BITS = [128, 256];
  var OUTPUT_TYPES = ['hex', 'buffer', 'arrayBuffer', 'array'];

  var createOutputMethod = function (bits, padding, outputType) {
    return function (message) {
      return new Keccak(bits, padding, bits).update(message)[outputType]();
    };
  };

  var createShakeOutputMethod = function (bits, padding, outputType) {
    return function (message, outputBits) {
      return new Keccak(bits, padding, outputBits).update(message)[outputType]();
    };
  };

  var createMethod = function (bits, padding) {
    var method = createOutputMethod(bits, padding, 'hex');
    method.create = function () {
      return new Keccak(bits, padding, bits);
    };
    method.update = function (message) {
      return method.create().update(message);
    };
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createOutputMethod(bits, padding, type);
    }
    return method;
  };

  var createShakeMethod = function (bits, padding) {
    var method = createShakeOutputMethod(bits, padding, 'hex');
    method.create = function (outputBits) {
      return new Keccak(bits, padding, outputBits);
    };
    method.update = function (message, outputBits) {
      return method.create(outputBits).update(message);
    };
    for (var i = 0; i < OUTPUT_TYPES.length; ++i) {
      var type = OUTPUT_TYPES[i];
      method[type] = createShakeOutputMethod(bits, padding, type);
    }
    return method;
  };

  var algorithms = [
    {name: 'keccak', padding: KECCAK_PADDING, bits: BITS, createMethod: createMethod},
    {name: 'sha3', padding: PADDING, bits: BITS, createMethod: createMethod},
    {name: 'shake', padding: SHAKE_PADDING, bits: SHAKE_BITS, createMethod: createShakeMethod}
  ];

  var methods = {}, methodNames = [];

  for (var i = 0; i < algorithms.length; ++i) {
    var algorithm = algorithms[i];
    var bits  = algorithm.bits;
    for (var j = 0; j < bits.length; ++j) {
      var methodName = algorithm.name +'_' + bits[j];
      methodNames.push(methodName);
      methods[methodName] = algorithm.createMethod(bits[j], algorithm.padding);
    }
  }

  function Keccak(bits, padding, outputBits) {
    this.blocks = [];
    this.s = [];
    this.padding = padding;
    this.outputBits = outputBits;
    this.reset = true;
    this.block = 0;
    this.start = 0;
    this.blockCount = (1600 - (bits << 1)) >> 5;
    this.byteCount = this.blockCount << 2;
    this.outputBlocks = outputBits >> 5;
    this.extraBytes = (outputBits & 31) >> 3;

    for (var i = 0; i < 50; ++i) {
      this.s[i] = 0;
    }
  }

  Keccak.prototype.update = function (message) {
    var notString = typeof message !== 'string';
    if (notString && message.constructor === ArrayBuffer) {
      message = new Uint8Array(message);
    }
    var length = message.length, blocks = this.blocks, byteCount = this.byteCount,
      blockCount = this.blockCount, index = 0, s = this.s, i, code;

    while (index < length) {
      if (this.reset) {
        this.reset = false;
        blocks[0] = this.block;
        for (i = 1; i < blockCount + 1; ++i) {
          blocks[i] = 0;
        }
      }
      if (notString) {
        for (i = this.start; index < length && i < byteCount; ++index) {
          blocks[i >> 2] |= message[index] << SHIFT[i++ & 3];
        }
      } else {
        for (i = this.start; index < length && i < byteCount; ++index) {
          code = message.charCodeAt(index);
          if (code < 0x80) {
            blocks[i >> 2] |= code << SHIFT[i++ & 3];
          } else if (code < 0x800) {
            blocks[i >> 2] |= (0xc0 | (code >> 6)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else if (code < 0xd800 || code >= 0xe000) {
            blocks[i >> 2] |= (0xe0 | (code >> 12)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          } else {
            code = 0x10000 + (((code & 0x3ff) << 10) | (message.charCodeAt(++index) & 0x3ff));
            blocks[i >> 2] |= (0xf0 | (code >> 18)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 12) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | ((code >> 6) & 0x3f)) << SHIFT[i++ & 3];
            blocks[i >> 2] |= (0x80 | (code & 0x3f)) << SHIFT[i++ & 3];
          }
        }
      }
      this.lastByteIndex = i;
      if (i >= byteCount) {
        this.start = i - byteCount;
        this.block = blocks[blockCount];
        for (i = 0; i < blockCount; ++i) {
          s[i] ^= blocks[i];
        }
        f(s);
        this.reset = true;
      } else {
        this.start = i;
      }
    }
    return this;
  };

  Keccak.prototype.finalize = function () {
    var blocks = this.blocks, i = this.lastByteIndex, blockCount = this.blockCount, s = this.s;
    blocks[i >> 2] |= this.padding[i & 3];
    if (this.lastByteIndex === this.byteCount) {
      blocks[0] = blocks[blockCount];
      for (i = 1; i < blockCount + 1; ++i) {
        blocks[i] = 0;
      }
    }
    blocks[blockCount - 1] |= 0x80000000;
    for (i = 0; i < blockCount; ++i) {
      s[i] ^= blocks[i];
    }
    f(s);
  };

  Keccak.prototype.toString = Keccak.prototype.hex = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
        extraBytes = this.extraBytes, i = 0, j = 0;
    var hex = '', block;
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        block = s[i];
        hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F] +
               HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F] +
               HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F] +
               HEX_CHARS[(block >> 28) & 0x0F] + HEX_CHARS[(block >> 24) & 0x0F];
      }
      if (j % blockCount === 0) {
        f(s);
        i = 0;
      }
    }
    if (extraBytes) {
      block = s[i];
      if (extraBytes > 0) {
        hex += HEX_CHARS[(block >> 4) & 0x0F] + HEX_CHARS[block & 0x0F];
      }
      if (extraBytes > 1) {
        hex += HEX_CHARS[(block >> 12) & 0x0F] + HEX_CHARS[(block >> 8) & 0x0F];
      }
      if (extraBytes > 2) {
        hex += HEX_CHARS[(block >> 20) & 0x0F] + HEX_CHARS[(block >> 16) & 0x0F];
      }
    }
    return hex;
  };

  Keccak.prototype.arrayBuffer = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
        extraBytes = this.extraBytes, i = 0, j = 0;
    var bytes = this.outputBits >> 3;
    var buffer;
    if (extraBytes) {
      buffer = new ArrayBuffer((outputBlocks + 1) << 2);
    } else {
      buffer = new ArrayBuffer(bytes);
    }
    var array = new Uint32Array(buffer);
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        array[j] = s[i];
      }
      if (j % blockCount === 0) {
        f(s);
      }
    }
    if (extraBytes) {
      array[i] = s[i];
      buffer = buffer.slice(0, bytes);
    }
    return buffer;
  };

  Keccak.prototype.buffer = Keccak.prototype.arrayBuffer;

  Keccak.prototype.digest = Keccak.prototype.array = function () {
    this.finalize();

    var blockCount = this.blockCount, s = this.s, outputBlocks = this.outputBlocks,
        extraBytes = this.extraBytes, i = 0, j = 0;
    var array = [], offset, block;
    while (j < outputBlocks) {
      for (i = 0; i < blockCount && j < outputBlocks; ++i, ++j) {
        offset = j << 2;
        block = s[i];
        array[offset] = block & 0xFF;
        array[offset + 1] = (block >> 8) & 0xFF;
        array[offset + 2] = (block >> 16) & 0xFF;
        array[offset + 3] = (block >> 24) & 0xFF;
      }
      if (j % blockCount === 0) {
        f(s);
      }
    }
    if (extraBytes) {
      offset = j << 2;
      block = s[i];
      if (extraBytes > 0) {
        array[offset] = block & 0xFF;
      }
      if (extraBytes > 1) {
        array[offset + 1] = (block >> 8) & 0xFF;
      }
      if (extraBytes > 2) {
        array[offset + 2] = (block >> 16) & 0xFF;
      }
    }
    return array;
  };

  var f = function (s) {
    var h, l, n, c0, c1, c2, c3, c4, c5, c6, c7, c8, c9,
        b0, b1, b2, b3, b4, b5, b6, b7, b8, b9, b10, b11, b12, b13, b14, b15, b16, b17,
        b18, b19, b20, b21, b22, b23, b24, b25, b26, b27, b28, b29, b30, b31, b32, b33,
        b34, b35, b36, b37, b38, b39, b40, b41, b42, b43, b44, b45, b46, b47, b48, b49;
    for (n = 0; n < 48; n += 2) {
      c0 = s[0] ^ s[10] ^ s[20] ^ s[30] ^ s[40];
      c1 = s[1] ^ s[11] ^ s[21] ^ s[31] ^ s[41];
      c2 = s[2] ^ s[12] ^ s[22] ^ s[32] ^ s[42];
      c3 = s[3] ^ s[13] ^ s[23] ^ s[33] ^ s[43];
      c4 = s[4] ^ s[14] ^ s[24] ^ s[34] ^ s[44];
      c5 = s[5] ^ s[15] ^ s[25] ^ s[35] ^ s[45];
      c6 = s[6] ^ s[16] ^ s[26] ^ s[36] ^ s[46];
      c7 = s[7] ^ s[17] ^ s[27] ^ s[37] ^ s[47];
      c8 = s[8] ^ s[18] ^ s[28] ^ s[38] ^ s[48];
      c9 = s[9] ^ s[19] ^ s[29] ^ s[39] ^ s[49];

      h = c8 ^ ((c2 << 1) | (c3 >>> 31));
      l = c9 ^ ((c3 << 1) | (c2 >>> 31));
      s[0] ^= h;
      s[1] ^= l;
      s[10] ^= h;
      s[11] ^= l;
      s[20] ^= h;
      s[21] ^= l;
      s[30] ^= h;
      s[31] ^= l;
      s[40] ^= h;
      s[41] ^= l;
      h = c0 ^ ((c4 << 1) | (c5 >>> 31));
      l = c1 ^ ((c5 << 1) | (c4 >>> 31));
      s[2] ^= h;
      s[3] ^= l;
      s[12] ^= h;
      s[13] ^= l;
      s[22] ^= h;
      s[23] ^= l;
      s[32] ^= h;
      s[33] ^= l;
      s[42] ^= h;
      s[43] ^= l;
      h = c2 ^ ((c6 << 1) | (c7 >>> 31));
      l = c3 ^ ((c7 << 1) | (c6 >>> 31));
      s[4] ^= h;
      s[5] ^= l;
      s[14] ^= h;
      s[15] ^= l;
      s[24] ^= h;
      s[25] ^= l;
      s[34] ^= h;
      s[35] ^= l;
      s[44] ^= h;
      s[45] ^= l;
      h = c4 ^ ((c8 << 1) | (c9 >>> 31));
      l = c5 ^ ((c9 << 1) | (c8 >>> 31));
      s[6] ^= h;
      s[7] ^= l;
      s[16] ^= h;
      s[17] ^= l;
      s[26] ^= h;
      s[27] ^= l;
      s[36] ^= h;
      s[37] ^= l;
      s[46] ^= h;
      s[47] ^= l;
      h = c6 ^ ((c0 << 1) | (c1 >>> 31));
      l = c7 ^ ((c1 << 1) | (c0 >>> 31));
      s[8] ^= h;
      s[9] ^= l;
      s[18] ^= h;
      s[19] ^= l;
      s[28] ^= h;
      s[29] ^= l;
      s[38] ^= h;
      s[39] ^= l;
      s[48] ^= h;
      s[49] ^= l;

      b0 = s[0];
      b1 = s[1];
      b32 = (s[11] << 4) | (s[10] >>> 28);
      b33 = (s[10] << 4) | (s[11] >>> 28);
      b14 = (s[20] << 3) | (s[21] >>> 29);
      b15 = (s[21] << 3) | (s[20] >>> 29);
      b46 = (s[31] << 9) | (s[30] >>> 23);
      b47 = (s[30] << 9) | (s[31] >>> 23);
      b28 = (s[40] << 18) | (s[41] >>> 14);
      b29 = (s[41] << 18) | (s[40] >>> 14);
      b20 = (s[2] << 1) | (s[3] >>> 31);
      b21 = (s[3] << 1) | (s[2] >>> 31);
      b2 = (s[13] << 12) | (s[12] >>> 20);
      b3 = (s[12] << 12) | (s[13] >>> 20);
      b34 = (s[22] << 10) | (s[23] >>> 22);
      b35 = (s[23] << 10) | (s[22] >>> 22);
      b16 = (s[33] << 13) | (s[32] >>> 19);
      b17 = (s[32] << 13) | (s[33] >>> 19);
      b48 = (s[42] << 2) | (s[43] >>> 30);
      b49 = (s[43] << 2) | (s[42] >>> 30);
      b40 = (s[5] << 30) | (s[4] >>> 2);
      b41 = (s[4] << 30) | (s[5] >>> 2);
      b22 = (s[14] << 6) | (s[15] >>> 26);
      b23 = (s[15] << 6) | (s[14] >>> 26);
      b4 = (s[25] << 11) | (s[24] >>> 21);
      b5 = (s[24] << 11) | (s[25] >>> 21);
      b36 = (s[34] << 15) | (s[35] >>> 17);
      b37 = (s[35] << 15) | (s[34] >>> 17);
      b18 = (s[45] << 29) | (s[44] >>> 3);
      b19 = (s[44] << 29) | (s[45] >>> 3);
      b10 = (s[6] << 28) | (s[7] >>> 4);
      b11 = (s[7] << 28) | (s[6] >>> 4);
      b42 = (s[17] << 23) | (s[16] >>> 9);
      b43 = (s[16] << 23) | (s[17] >>> 9);
      b24 = (s[26] << 25) | (s[27] >>> 7);
      b25 = (s[27] << 25) | (s[26] >>> 7);
      b6 = (s[36] << 21) | (s[37] >>> 11);
      b7 = (s[37] << 21) | (s[36] >>> 11);
      b38 = (s[47] << 24) | (s[46] >>> 8);
      b39 = (s[46] << 24) | (s[47] >>> 8);
      b30 = (s[8] << 27) | (s[9] >>> 5);
      b31 = (s[9] << 27) | (s[8] >>> 5);
      b12 = (s[18] << 20) | (s[19] >>> 12);
      b13 = (s[19] << 20) | (s[18] >>> 12);
      b44 = (s[29] << 7) | (s[28] >>> 25);
      b45 = (s[28] << 7) | (s[29] >>> 25);
      b26 = (s[38] << 8) | (s[39] >>> 24);
      b27 = (s[39] << 8) | (s[38] >>> 24);
      b8 = (s[48] << 14) | (s[49] >>> 18);
      b9 = (s[49] << 14) | (s[48] >>> 18);

      s[0] = b0 ^ (~b2 & b4);
      s[1] = b1 ^ (~b3 & b5);
      s[10] = b10 ^ (~b12 & b14);
      s[11] = b11 ^ (~b13 & b15);
      s[20] = b20 ^ (~b22 & b24);
      s[21] = b21 ^ (~b23 & b25);
      s[30] = b30 ^ (~b32 & b34);
      s[31] = b31 ^ (~b33 & b35);
      s[40] = b40 ^ (~b42 & b44);
      s[41] = b41 ^ (~b43 & b45);
      s[2] = b2 ^ (~b4 & b6);
      s[3] = b3 ^ (~b5 & b7);
      s[12] = b12 ^ (~b14 & b16);
      s[13] = b13 ^ (~b15 & b17);
      s[22] = b22 ^ (~b24 & b26);
      s[23] = b23 ^ (~b25 & b27);
      s[32] = b32 ^ (~b34 & b36);
      s[33] = b33 ^ (~b35 & b37);
      s[42] = b42 ^ (~b44 & b46);
      s[43] = b43 ^ (~b45 & b47);
      s[4] = b4 ^ (~b6 & b8);
      s[5] = b5 ^ (~b7 & b9);
      s[14] = b14 ^ (~b16 & b18);
      s[15] = b15 ^ (~b17 & b19);
      s[24] = b24 ^ (~b26 & b28);
      s[25] = b25 ^ (~b27 & b29);
      s[34] = b34 ^ (~b36 & b38);
      s[35] = b35 ^ (~b37 & b39);
      s[44] = b44 ^ (~b46 & b48);
      s[45] = b45 ^ (~b47 & b49);
      s[6] = b6 ^ (~b8 & b0);
      s[7] = b7 ^ (~b9 & b1);
      s[16] = b16 ^ (~b18 & b10);
      s[17] = b17 ^ (~b19 & b11);
      s[26] = b26 ^ (~b28 & b20);
      s[27] = b27 ^ (~b29 & b21);
      s[36] = b36 ^ (~b38 & b30);
      s[37] = b37 ^ (~b39 & b31);
      s[46] = b46 ^ (~b48 & b40);
      s[47] = b47 ^ (~b49 & b41);
      s[8] = b8 ^ (~b0 & b2);
      s[9] = b9 ^ (~b1 & b3);
      s[18] = b18 ^ (~b10 & b12);
      s[19] = b19 ^ (~b11 & b13);
      s[28] = b28 ^ (~b20 & b22);
      s[29] = b29 ^ (~b21 & b23);
      s[38] = b38 ^ (~b30 & b32);
      s[39] = b39 ^ (~b31 & b33);
      s[48] = b48 ^ (~b40 & b42);
      s[49] = b49 ^ (~b41 & b43);

      s[0] ^= RC[n];
      s[1] ^= RC[n + 1];
    }
  };

  if (COMMON_JS) {
    module.exports = methods;
  } else {
    for (var i = 0; i < methodNames.length; ++i) {
      root[methodNames[i]] = methods[methodNames[i]];
    }
  }
})();

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"_process":49}],48:[function(require,module,exports){
module.exports = assert;

function assert(val, msg) {
  if (!val)
    throw new Error(msg || 'Assertion failed');
}

assert.equal = function assertEqual(l, r, msg) {
  if (l != r)
    throw new Error(msg || ('Assertion failed: ' + l + ' != ' + r));
};

},{}],49:[function(require,module,exports){
module.exports = undefined;
},{}]},{},[1]);
