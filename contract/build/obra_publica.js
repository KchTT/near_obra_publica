function _applyDecoratedDescriptor(target, property, decorators, descriptor, context) {
  var desc = {};
  Object.keys(descriptor).forEach(function (key) {
    desc[key] = descriptor[key];
  });
  desc.enumerable = !!desc.enumerable;
  desc.configurable = !!desc.configurable;

  if ('value' in desc || desc.initializer) {
    desc.writable = true;
  }

  desc = decorators.slice().reverse().reduce(function (desc, decorator) {
    return decorator(target, property, desc) || desc;
  }, desc);

  if (context && desc.initializer !== void 0) {
    desc.value = desc.initializer ? desc.initializer.call(context) : void 0;
    desc.initializer = undefined;
  }

  if (desc.initializer === void 0) {
    Object.defineProperty(target, property, desc);
    desc = null;
  }

  return desc;
}

var PromiseResult;

(function (PromiseResult) {
  PromiseResult[PromiseResult["NotReady"] = 0] = "NotReady";
  PromiseResult[PromiseResult["Successful"] = 1] = "Successful";
  PromiseResult[PromiseResult["Failed"] = 2] = "Failed";
})(PromiseResult || (PromiseResult = {}));

var PromiseError;

(function (PromiseError) {
  PromiseError[PromiseError["Failed"] = 0] = "Failed";
  PromiseError[PromiseError["NotReady"] = 1] = "NotReady";
})(PromiseError || (PromiseError = {}));

/*! scure-base - MIT License (c) 2022 Paul Miller (paulmillr.com) */
function assertNumber(n) {
  if (!Number.isSafeInteger(n)) throw new Error(`Wrong integer: ${n}`);
}

function chain(...args) {
  const wrap = (a, b) => c => a(b(c));

  const encode = Array.from(args).reverse().reduce((acc, i) => acc ? wrap(acc, i.encode) : i.encode, undefined);
  const decode = args.reduce((acc, i) => acc ? wrap(acc, i.decode) : i.decode, undefined);
  return {
    encode,
    decode
  };
}

function alphabet(alphabet) {
  return {
    encode: digits => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== 'number') throw new Error('alphabet.encode input should be an array of numbers');
      return digits.map(i => {
        assertNumber(i);
        if (i < 0 || i >= alphabet.length) throw new Error(`Digit index outside alphabet: ${i} (alphabet: ${alphabet.length})`);
        return alphabet[i];
      });
    },
    decode: input => {
      if (!Array.isArray(input) || input.length && typeof input[0] !== 'string') throw new Error('alphabet.decode input should be array of strings');
      return input.map(letter => {
        if (typeof letter !== 'string') throw new Error(`alphabet.decode: not string element=${letter}`);
        const index = alphabet.indexOf(letter);
        if (index === -1) throw new Error(`Unknown letter: "${letter}". Allowed: ${alphabet}`);
        return index;
      });
    }
  };
}

function join(separator = '') {
  if (typeof separator !== 'string') throw new Error('join separator should be string');
  return {
    encode: from => {
      if (!Array.isArray(from) || from.length && typeof from[0] !== 'string') throw new Error('join.encode input should be array of strings');

      for (let i of from) if (typeof i !== 'string') throw new Error(`join.encode: non-string input=${i}`);

      return from.join(separator);
    },
    decode: to => {
      if (typeof to !== 'string') throw new Error('join.decode input should be string');
      return to.split(separator);
    }
  };
}

function padding(bits, chr = '=') {
  assertNumber(bits);
  if (typeof chr !== 'string') throw new Error('padding chr should be string');
  return {
    encode(data) {
      if (!Array.isArray(data) || data.length && typeof data[0] !== 'string') throw new Error('padding.encode input should be array of strings');

      for (let i of data) if (typeof i !== 'string') throw new Error(`padding.encode: non-string input=${i}`);

      while (data.length * bits % 8) data.push(chr);

      return data;
    },

    decode(input) {
      if (!Array.isArray(input) || input.length && typeof input[0] !== 'string') throw new Error('padding.encode input should be array of strings');

      for (let i of input) if (typeof i !== 'string') throw new Error(`padding.decode: non-string input=${i}`);

      let end = input.length;
      if (end * bits % 8) throw new Error('Invalid padding: string should have whole number of bytes');

      for (; end > 0 && input[end - 1] === chr; end--) {
        if (!((end - 1) * bits % 8)) throw new Error('Invalid padding: string has too much padding');
      }

      return input.slice(0, end);
    }

  };
}

function normalize(fn) {
  if (typeof fn !== 'function') throw new Error('normalize fn should be function');
  return {
    encode: from => from,
    decode: to => fn(to)
  };
}

function convertRadix(data, from, to) {
  if (from < 2) throw new Error(`convertRadix: wrong from=${from}, base cannot be less than 2`);
  if (to < 2) throw new Error(`convertRadix: wrong to=${to}, base cannot be less than 2`);
  if (!Array.isArray(data)) throw new Error('convertRadix: data should be array');
  if (!data.length) return [];
  let pos = 0;
  const res = [];
  const digits = Array.from(data);
  digits.forEach(d => {
    assertNumber(d);
    if (d < 0 || d >= from) throw new Error(`Wrong integer: ${d}`);
  });

  while (true) {
    let carry = 0;
    let done = true;

    for (let i = pos; i < digits.length; i++) {
      const digit = digits[i];
      const digitBase = from * carry + digit;

      if (!Number.isSafeInteger(digitBase) || from * carry / from !== carry || digitBase - digit !== from * carry) {
        throw new Error('convertRadix: carry overflow');
      }

      carry = digitBase % to;
      digits[i] = Math.floor(digitBase / to);
      if (!Number.isSafeInteger(digits[i]) || digits[i] * to + carry !== digitBase) throw new Error('convertRadix: carry overflow');
      if (!done) continue;else if (!digits[i]) pos = i;else done = false;
    }

    res.push(carry);
    if (done) break;
  }

  for (let i = 0; i < data.length - 1 && data[i] === 0; i++) res.push(0);

  return res.reverse();
}

const gcd = (a, b) => !b ? a : gcd(b, a % b);

const radix2carry = (from, to) => from + (to - gcd(from, to));

function convertRadix2(data, from, to, padding) {
  if (!Array.isArray(data)) throw new Error('convertRadix2: data should be array');
  if (from <= 0 || from > 32) throw new Error(`convertRadix2: wrong from=${from}`);
  if (to <= 0 || to > 32) throw new Error(`convertRadix2: wrong to=${to}`);

  if (radix2carry(from, to) > 32) {
    throw new Error(`convertRadix2: carry overflow from=${from} to=${to} carryBits=${radix2carry(from, to)}`);
  }

  let carry = 0;
  let pos = 0;
  const mask = 2 ** to - 1;
  const res = [];

  for (const n of data) {
    assertNumber(n);
    if (n >= 2 ** from) throw new Error(`convertRadix2: invalid data word=${n} from=${from}`);
    carry = carry << from | n;
    if (pos + from > 32) throw new Error(`convertRadix2: carry overflow pos=${pos} from=${from}`);
    pos += from;

    for (; pos >= to; pos -= to) res.push((carry >> pos - to & mask) >>> 0);

    carry &= 2 ** pos - 1;
  }

  carry = carry << to - pos & mask;
  if (!padding && pos >= from) throw new Error('Excess padding');
  if (!padding && carry) throw new Error(`Non-zero padding: ${carry}`);
  if (padding && pos > 0) res.push(carry >>> 0);
  return res;
}

function radix(num) {
  assertNumber(num);
  return {
    encode: bytes => {
      if (!(bytes instanceof Uint8Array)) throw new Error('radix.encode input should be Uint8Array');
      return convertRadix(Array.from(bytes), 2 ** 8, num);
    },
    decode: digits => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== 'number') throw new Error('radix.decode input should be array of strings');
      return Uint8Array.from(convertRadix(digits, num, 2 ** 8));
    }
  };
}

function radix2(bits, revPadding = false) {
  assertNumber(bits);
  if (bits <= 0 || bits > 32) throw new Error('radix2: bits should be in (0..32]');
  if (radix2carry(8, bits) > 32 || radix2carry(bits, 8) > 32) throw new Error('radix2: carry overflow');
  return {
    encode: bytes => {
      if (!(bytes instanceof Uint8Array)) throw new Error('radix2.encode input should be Uint8Array');
      return convertRadix2(Array.from(bytes), 8, bits, !revPadding);
    },
    decode: digits => {
      if (!Array.isArray(digits) || digits.length && typeof digits[0] !== 'number') throw new Error('radix2.decode input should be array of strings');
      return Uint8Array.from(convertRadix2(digits, bits, 8, revPadding));
    }
  };
}

function unsafeWrapper(fn) {
  if (typeof fn !== 'function') throw new Error('unsafeWrapper fn should be function');
  return function (...args) {
    try {
      return fn.apply(null, args);
    } catch (e) {}
  };
}
const base16 = chain(radix2(4), alphabet('0123456789ABCDEF'), join(''));
const base32 = chain(radix2(5), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'), padding(5), join(''));
chain(radix2(5), alphabet('0123456789ABCDEFGHIJKLMNOPQRSTUV'), padding(5), join(''));
chain(radix2(5), alphabet('0123456789ABCDEFGHJKMNPQRSTVWXYZ'), join(''), normalize(s => s.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1')));
const base64 = chain(radix2(6), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'), padding(6), join(''));
const base64url = chain(radix2(6), alphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'), padding(6), join(''));

const genBase58 = abc => chain(radix(58), alphabet(abc), join(''));

const base58 = genBase58('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz');
genBase58('123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ');
genBase58('rpshnaf39wBUDNEGHJKLM4PQRST7VWXYZ2bcdeCg65jkm8oFqi1tuvAxyz');
const XMR_BLOCK_LEN = [0, 2, 3, 5, 6, 7, 9, 10, 11];
const base58xmr = {
  encode(data) {
    let res = '';

    for (let i = 0; i < data.length; i += 8) {
      const block = data.subarray(i, i + 8);
      res += base58.encode(block).padStart(XMR_BLOCK_LEN[block.length], '1');
    }

    return res;
  },

  decode(str) {
    let res = [];

    for (let i = 0; i < str.length; i += 11) {
      const slice = str.slice(i, i + 11);
      const blockLen = XMR_BLOCK_LEN.indexOf(slice.length);
      const block = base58.decode(slice);

      for (let j = 0; j < block.length - blockLen; j++) {
        if (block[j] !== 0) throw new Error('base58xmr: wrong padding');
      }

      res = res.concat(Array.from(block.slice(block.length - blockLen)));
    }

    return Uint8Array.from(res);
  }

};
const BECH_ALPHABET = chain(alphabet('qpzry9x8gf2tvdw0s3jn54khce6mua7l'), join(''));
const POLYMOD_GENERATORS = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];

function bech32Polymod(pre) {
  const b = pre >> 25;
  let chk = (pre & 0x1ffffff) << 5;

  for (let i = 0; i < POLYMOD_GENERATORS.length; i++) {
    if ((b >> i & 1) === 1) chk ^= POLYMOD_GENERATORS[i];
  }

  return chk;
}

function bechChecksum(prefix, words, encodingConst = 1) {
  const len = prefix.length;
  let chk = 1;

  for (let i = 0; i < len; i++) {
    const c = prefix.charCodeAt(i);
    if (c < 33 || c > 126) throw new Error(`Invalid prefix (${prefix})`);
    chk = bech32Polymod(chk) ^ c >> 5;
  }

  chk = bech32Polymod(chk);

  for (let i = 0; i < len; i++) chk = bech32Polymod(chk) ^ prefix.charCodeAt(i) & 0x1f;

  for (let v of words) chk = bech32Polymod(chk) ^ v;

  for (let i = 0; i < 6; i++) chk = bech32Polymod(chk);

  chk ^= encodingConst;
  return BECH_ALPHABET.encode(convertRadix2([chk % 2 ** 30], 30, 5, false));
}

function genBech32(encoding) {
  const ENCODING_CONST = encoding === 'bech32' ? 1 : 0x2bc830a3;

  const _words = radix2(5);

  const fromWords = _words.decode;
  const toWords = _words.encode;
  const fromWordsUnsafe = unsafeWrapper(fromWords);

  function encode(prefix, words, limit = 90) {
    if (typeof prefix !== 'string') throw new Error(`bech32.encode prefix should be string, not ${typeof prefix}`);
    if (!Array.isArray(words) || words.length && typeof words[0] !== 'number') throw new Error(`bech32.encode words should be array of numbers, not ${typeof words}`);
    const actualLength = prefix.length + 7 + words.length;
    if (limit !== false && actualLength > limit) throw new TypeError(`Length ${actualLength} exceeds limit ${limit}`);
    prefix = prefix.toLowerCase();
    return `${prefix}1${BECH_ALPHABET.encode(words)}${bechChecksum(prefix, words, ENCODING_CONST)}`;
  }

  function decode(str, limit = 90) {
    if (typeof str !== 'string') throw new Error(`bech32.decode input should be string, not ${typeof str}`);
    if (str.length < 8 || limit !== false && str.length > limit) throw new TypeError(`Wrong string length: ${str.length} (${str}). Expected (8..${limit})`);
    const lowered = str.toLowerCase();
    if (str !== lowered && str !== str.toUpperCase()) throw new Error(`String must be lowercase or uppercase`);
    str = lowered;
    const sepIndex = str.lastIndexOf('1');
    if (sepIndex === 0 || sepIndex === -1) throw new Error(`Letter "1" must be present between prefix and data only`);
    const prefix = str.slice(0, sepIndex);

    const _words = str.slice(sepIndex + 1);

    if (_words.length < 6) throw new Error('Data must be at least 6 characters long');
    const words = BECH_ALPHABET.decode(_words).slice(0, -6);
    const sum = bechChecksum(prefix, words, ENCODING_CONST);
    if (!_words.endsWith(sum)) throw new Error(`Invalid checksum in ${str}: expected "${sum}"`);
    return {
      prefix,
      words
    };
  }

  const decodeUnsafe = unsafeWrapper(decode);

  function decodeToBytes(str) {
    const {
      prefix,
      words
    } = decode(str, false);
    return {
      prefix,
      words,
      bytes: fromWords(words)
    };
  }

  return {
    encode,
    decode,
    decodeToBytes,
    decodeUnsafe,
    fromWords,
    fromWordsUnsafe,
    toWords
  };
}

genBech32('bech32');
genBech32('bech32m');
const utf8 = {
  encode: data => new TextDecoder().decode(data),
  decode: str => new TextEncoder().encode(str)
};
const hex = chain(radix2(4), alphabet('0123456789abcdef'), join(''), normalize(s => {
  if (typeof s !== 'string' || s.length % 2) throw new TypeError(`hex.decode: expected string, got ${typeof s} with length ${s.length}`);
  return s.toLowerCase();
}));
const CODERS = {
  utf8,
  hex,
  base16,
  base32,
  base64,
  base64url,
  base58,
  base58xmr
};
`Invalid encoding type. Available types: ${Object.keys(CODERS).join(', ')}`;

var CurveType;

(function (CurveType) {
  CurveType[CurveType["ED25519"] = 0] = "ED25519";
  CurveType[CurveType["SECP256K1"] = 1] = "SECP256K1";
})(CurveType || (CurveType = {}));

const U64_MAX = 2n ** 64n - 1n;
const EVICTED_REGISTER = U64_MAX - 1n;
function log(...params) {
  env.log(`${params.map(x => x === undefined ? 'undefined' : x) // Stringify undefined
  .map(x => typeof x === 'object' ? JSON.stringify(x) : x) // Convert Objects to strings
  .join(' ')}` // Convert to string
  );
}
function predecessorAccountId() {
  env.predecessor_account_id(0);
  return env.read_register(0);
}
function blockTimestamp() {
  return env.block_timestamp();
}
function attachedDeposit() {
  return env.attached_deposit();
}
function storageRead(key) {
  let ret = env.storage_read(key, 0);

  if (ret === 1n) {
    return env.read_register(0);
  } else {
    return null;
  }
}
function currentAccountId() {
  env.current_account_id(0);
  return env.read_register(0);
}
function input() {
  env.input(0);
  return env.read_register(0);
}
function promiseBatchCreate(accountId) {
  return env.promise_batch_create(accountId);
}
function promiseBatchActionTransfer(promiseIndex, amount) {
  env.promise_batch_action_transfer(promiseIndex, amount);
}
function storageWrite(key, value) {
  let exist = env.storage_write(key, value, EVICTED_REGISTER);

  if (exist === 1n) {
    return true;
  }

  return false;
}

function call({
  privateFunction = false,
  payableFunction = false
}) {
  return function (target, key, descriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args) {
      if (privateFunction && predecessorAccountId() !== currentAccountId()) {
        throw Error("Function is private");
      }

      if (!payableFunction && attachedDeposit() > BigInt(0)) {
        throw Error("Function is not payable");
      }

      return originalMethod.apply(this, args);
    };
  };
}
function view({}) {
  return function (target, key, descriptor) {};
}
function NearBindgen({
  requireInit = false
}) {
  return target => {
    return class extends target {
      static _create() {
        return new target();
      }

      static _getState() {
        const rawState = storageRead("STATE");
        return rawState ? this._deserialize(rawState) : null;
      }

      static _saveToStorage(obj) {
        storageWrite("STATE", this._serialize(obj));
      }

      static _getArgs() {
        return JSON.parse(input() || "{}");
      }

      static _serialize(value) {
        return JSON.stringify(value);
      }

      static _deserialize(value) {
        return JSON.parse(value);
      }

      static _reconstruct(classObject, plainObject) {
        for (const item in classObject) {
          if (classObject[item].constructor?.deserialize !== undefined) {
            classObject[item] = classObject[item].constructor.deserialize(plainObject[item]);
          } else {
            classObject[item] = plainObject[item];
          }
        }

        return classObject;
      }

      static _requireInit() {
        return requireInit;
      }

    };
  };
}

class Licitacion {
  //dias
  constructor({
    sender,
    unix_timestamp,
    pos,
    empresa,
    cuit,
    descripcion,
    monto,
    tiempo,
    hash_presupuesto,
    estado
  }) {
    this.sender = sender;
    this.unix_timestamp = unix_timestamp;
    this.pos = pos;
    this.empresa = empresa;
    this.cuit = cuit;
    this.descripcion = descripcion;
    this.monto = monto;
    this.tiempo = tiempo;
    this.hash_presupuesto = hash_presupuesto;
    this.estado = estado;
  }

  get_estado() {
    return this.estado;
  }

  cambia_estado(estado) {
    this.estado = estado;
  }

  evalua(valoracion, justificacion, estado) {
    const unix_timestamp = Math.floor(Date.now() / 1000);
    this.fecha_evaluacion = unix_timestamp;
    this.valoracion = valoracion;
    this.justificacion = justificacion;
    this.estado = estado;
  }

}

const estados = ["STAND BY", "ACTIVA", "FINALIZADA", "CANCELADA"];
class Proyecto {
  constructor({
    sender,
    unix_timestamp,
    pos,
    nombre,
    ubicacion,
    descripcion,
    apertura_licitacion,
    fecha_limite_licitacion,
    hash_pliego,
    estado
  }) {
    this.sender = sender;
    this.unix_timestamp = unix_timestamp;
    this.pos = pos;
    this.nombre = nombre;
    this.ubicacion = ubicacion;
    this.descripcion = descripcion;
    this.apertura_licitacion = apertura_licitacion;
    this.fecha_limite_licitacion = fecha_limite_licitacion;
    this.hash_pliego = hash_pliego;
    this.estado = estado;
    this.licitaciones = [];
  }

  getter() {
    return {
      sender: this.sender,
      fecha: this.unix_timestamp,
      pos: this.pos,
      nombre: this.nombre,
      ubicacion: this.ubicacion,
      descripcion: this.descripcion,
      apertura_licitacion: this.apertura_licitacion,
      fecha_limite_licitacion: this.fecha_limite_licitacion,
      hash_pliego: this.hash_pliego,
      estado: estados[this.estado]
    };
  }

  cambia_estado(estado) {
    this.estado = estado;
  }

  checkBetween(from, to) {
    return this.unix_timestamp >= from && this.unix_timestamp <= to ? true : false;
  }

  checkActiva() {
    return this.estado == 1 ? true : false;
  }

  get_licitacion(index_licitacion) {
    return this.licitaciones[index_licitacion];
  }

  agrega_licitacion(sender, unix_timestamp, pos, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado) {
    const licitacion = new Licitacion({
      sender,
      unix_timestamp,
      pos,
      empresa,
      cuit,
      descripcion,
      monto,
      tiempo,
      hash_presupuesto,
      estado
    });
    this.licitaciones.push(licitacion);
  }

  cambia_estado_licitacion(index_licitacion, estado) {
    this.licitaciones[index_licitacion].cambia_estado(estado);
  }

  evalua_licitacion(index_licitacion, valoracion, justificacion, estado) {
    this.licitaciones[index_licitacion].evalua(valoracion, justificacion, estado);
  }

}

class LicitacionCuenta {
  constructor({
    unix_timestamp,
    index_obra,
    index_licitacion
  }) {
    this.unix_timestamp = unix_timestamp;
    this.index_obra = index_obra;
    this.index_licitacion = index_licitacion;
  }

}

var _dec, _dec2, _dec3, _dec4, _dec5, _dec6, _dec7, _dec8, _dec9, _dec10, _dec11, _dec12, _dec13, _dec14, _dec15, _dec16, _dec17, _dec18, _dec19, _class, _class2;
let ObraPublica = (_dec = NearBindgen({}), _dec2 = view({}), _dec3 = view({}), _dec4 = view({}), _dec5 = view({}), _dec6 = view({}), _dec7 = call({
  payableFunction: true
}), _dec8 = call({
  payableFunction: true
}), _dec9 = view({}), _dec10 = call({
  payableFunction: true
}), _dec11 = call({
  payableFunction: true
}), _dec12 = view({}), _dec13 = view({}), _dec14 = call({
  payableFunction: true
}), _dec15 = call({
  payableFunction: true
}), _dec16 = view({}), _dec17 = call({
  payableFunction: true
}), _dec18 = view({}), _dec19 = call({
  payableFunction: true
}), _dec(_class = (_class2 = class ObraPublica {
  constructor() {
    this.titular = 'martinbronzino.testnet';
    this.costo_participacion = "2000000000000000000000";
    this.proyectos = [];
    this.proyectos_new = {};
    this.licitaciones_cuentas = {};
  }

  get_proyectos({
    from = 0,
    to = 0
  }) {
    let proyectos = [];

    for (let p of this.proyectos) {
      if (p.unix_timestamp >= from && p.unix_timestamp <= to) {
        proyectos.push(p);
      }
    }

    return proyectos;
  }

  get_all_proyectos({}) {
    return this.proyectos;
  }

  get_all_proyectos_new({}) {
    return this.proyectos_new;
  }

  get_proyecto({
    unix_timestamp
  }) {
    const p = this.proyectos.find(p => p.unix_timestamp === unix_timestamp); //const p:Proyecto = new Proyecto(this.proyectos.find(p=>p.unix_timestamp===unix_timestamp))
    //near.log(p.checkActiva())

    return p;
  }

  get_cantidad_proyectos({}) {
    return this.proyectos.length;
  }

  add_obra({
    nombre,
    ubicacion,
    descripcion,
    apertura_licitacion,
    fecha_limite_licitacion,
    hash_pliego,
    estado
  }) {
    const unix_timestamp = Math.floor(Number(blockTimestamp()) / 1000000000);
    const sender = predecessorAccountId();
    const pos = this.proyectos.length;
    const proyecto = new Proyecto({
      sender,
      unix_timestamp,
      pos,
      nombre,
      ubicacion,
      descripcion,
      apertura_licitacion,
      fecha_limite_licitacion,
      hash_pliego,
      estado
    });
    this.proyectos_new[unix_timestamp] = proyecto;
    this.proyectos.push(proyecto);
    log(`Se agrego una obra nueva: ${nombre} con el key:${unix_timestamp}`);
  }

  limpia_proyectos({}) {
    this.proyectos = [];
    this.proyectos_new = {};
    this.licitaciones_cuentas = {};
  }

  get_licitaciones_activas({}) {
    const now_unix = Math.floor(Number(blockTimestamp()) / 1000000000);
    let proyectos = [];

    for (let p of this.proyectos) {
      if (p.apertura_licitacion <= now_unix && p.fecha_limite_licitacion >= now_unix) {
        proyectos.push(p);
      }
    }

    return proyectos;
  }

  estado_obra({
    index,
    estado
  }) {
    const sender = predecessorAccountId();
    const owner = this.proyectos[index].sender;
    assert(sender === owner, "Solo puede modificarlo el titular del contrato"); //const p:Proyecto = this.proyectos[index]
    //p.cambia_estado(estado)

    this.proyectos[index].estado = estado;
  }

  add_licitacion({
    index_obra,
    empresa,
    cuit,
    descripcion,
    monto,
    tiempo,
    hash_presupuesto,
    estado
  }) {
    const unix_timestamp = Math.floor(Number(blockTimestamp()) / 1000000000);
    const sender = predecessorAccountId();
    const arancel = attachedDeposit();
    assert(BigInt(this.costo_participacion) === arancel, "No transfirio el monto necesario para participar de la licitaci??n");
    const p = this.proyectos[index_obra];
    const index_licitacion = p.licitaciones.length; //const p:Proyecto = this.proyectos[index_obra]
    //p.agrega_licitacion(sender,unix_timestamp, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado)

    const licitacion = new Licitacion({
      sender,
      unix_timestamp,
      pos: index_licitacion,
      empresa,
      cuit,
      descripcion,
      monto,
      tiempo,
      hash_presupuesto,
      estado
    });
    p.licitaciones.push(licitacion);
    this.proyectos_new[p.unix_timestamp].licitaciones.push(licitacion); // const index_licitacion=this.proyectos[index_obra].licitaciones.length-1

    const licitacion_cuenta = new LicitacionCuenta({
      unix_timestamp,
      index_obra,
      index_licitacion
    });

    if (!this.licitaciones_cuentas.hasOwnProperty(sender)) {
      this.licitaciones_cuentas[sender] = [];
    }

    this.licitaciones_cuentas[sender].push(licitacion_cuenta);
    const promise = promiseBatchCreate(this.titular);
    promiseBatchActionTransfer(promise, arancel);
    log(`${sender} ya estas participando de la licitaci??n`);
  }

  get_mis_licitaciones() {
    const sender = predecessorAccountId();
    let licitaciones = [];

    if (this.licitaciones_cuentas.hasOwnProperty(sender)) {
      for (let l of this.licitaciones_cuentas[sender]) {
        let proyecto = Object.assign({}, this.proyectos[l.index_obra]);
        const mi_licitacion = proyecto.licitaciones[l.index_licitacion];
        proyecto.licitaciones = [mi_licitacion];
        licitaciones.push(proyecto);
      }
    }

    return licitaciones;
  }

  get_licitacion(index_obra, index_licitacion) {
    const p = this.proyectos_new[index_obra];
    const licitacion = p.licitaciones[index_licitacion];
    return licitacion;
  }

  estado_licitacion({
    index_obra,
    index_licitacion,
    estado
  }) {
    const sender = predecessorAccountId();
    const owner = this.proyectos[index_obra].sender;
    assert(sender === owner, "Solo puede modificarlo el titular del contrato");
    const p = this.proyectos[index_obra];
    const l = p.licitaciones[index_licitacion]; //p.get_licitacion(index_licitacion)
    //l.cambia_estado(estado)

    l.estado = estado;
  }

  evaluar_licitacion({
    index_obra,
    index_licitacion,
    valoracion,
    justificacion,
    estado
  }) {
    //VALIDAR QUE CUENTAS PUEDEN EVALUAR y NO PERMITIR QUE SE EVALUE MAS DE UNA VEZ
    const sender = predecessorAccountId();
    const owner = this.proyectos[index_obra].sender;
    const p = this.proyectos[index_obra];
    const l = p.licitaciones[index_licitacion]; //p.get_licitacion(index_licitacion)

    assert(sender === owner, "Solo puede modificarlo el titular del contrato");
    assert(l.estado <= 1, "Ya no esta disponible para evaluacion");
    l.valoracion = valoracion;
    l.justificacion = justificacion;
    l.estado = estado; //assert(l.estado<=1,"Ya no esta disponible para evaluacion")
    //l.evalua(valoracion,justificacion,estado)
  }

  get_arancel({}) {
    return this.costo_participacion;
  }

  modifica_arancel({
    arancel
  }) {
    const sender = predecessorAccountId();
    assert(sender === this.titular, "Solo puede modificarlo el titular de la dapp"); //near.log(`Se modifico el arancel a: ${arancel}`);

    this.costo_participacion = arancel;
  }

  get_titular({}) {
    return this.titular;
  }

  modifica_titular({
    titular
  }) {
    const sender = predecessorAccountId();
    assert(sender === this.titular, "Solo puede modificarlo el titular de la dapp");
    this.titular = titular;
  }

}, (_applyDecoratedDescriptor(_class2.prototype, "get_proyectos", [_dec2], Object.getOwnPropertyDescriptor(_class2.prototype, "get_proyectos"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_all_proyectos", [_dec3], Object.getOwnPropertyDescriptor(_class2.prototype, "get_all_proyectos"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_all_proyectos_new", [_dec4], Object.getOwnPropertyDescriptor(_class2.prototype, "get_all_proyectos_new"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_proyecto", [_dec5], Object.getOwnPropertyDescriptor(_class2.prototype, "get_proyecto"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_cantidad_proyectos", [_dec6], Object.getOwnPropertyDescriptor(_class2.prototype, "get_cantidad_proyectos"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "add_obra", [_dec7], Object.getOwnPropertyDescriptor(_class2.prototype, "add_obra"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "limpia_proyectos", [_dec8], Object.getOwnPropertyDescriptor(_class2.prototype, "limpia_proyectos"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_licitaciones_activas", [_dec9], Object.getOwnPropertyDescriptor(_class2.prototype, "get_licitaciones_activas"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "estado_obra", [_dec10], Object.getOwnPropertyDescriptor(_class2.prototype, "estado_obra"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "add_licitacion", [_dec11], Object.getOwnPropertyDescriptor(_class2.prototype, "add_licitacion"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_mis_licitaciones", [_dec12], Object.getOwnPropertyDescriptor(_class2.prototype, "get_mis_licitaciones"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_licitacion", [_dec13], Object.getOwnPropertyDescriptor(_class2.prototype, "get_licitacion"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "estado_licitacion", [_dec14], Object.getOwnPropertyDescriptor(_class2.prototype, "estado_licitacion"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "evaluar_licitacion", [_dec15], Object.getOwnPropertyDescriptor(_class2.prototype, "evaluar_licitacion"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_arancel", [_dec16], Object.getOwnPropertyDescriptor(_class2.prototype, "get_arancel"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "modifica_arancel", [_dec17], Object.getOwnPropertyDescriptor(_class2.prototype, "modifica_arancel"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "get_titular", [_dec18], Object.getOwnPropertyDescriptor(_class2.prototype, "get_titular"), _class2.prototype), _applyDecoratedDescriptor(_class2.prototype, "modifica_titular", [_dec19], Object.getOwnPropertyDescriptor(_class2.prototype, "modifica_titular"), _class2.prototype)), _class2)) || _class);
function modifica_titular() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.modifica_titular(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_titular() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_titular(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function modifica_arancel() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.modifica_arancel(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_arancel() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_arancel(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function evaluar_licitacion() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.evaluar_licitacion(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function estado_licitacion() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.estado_licitacion(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_licitacion() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_licitacion(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_mis_licitaciones() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_mis_licitaciones(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function add_licitacion() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.add_licitacion(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function estado_obra() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.estado_obra(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_licitaciones_activas() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_licitaciones_activas(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function limpia_proyectos() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.limpia_proyectos(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function add_obra() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.add_obra(_args);

  ObraPublica._saveToStorage(_contract);

  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_cantidad_proyectos() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_cantidad_proyectos(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_proyecto() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_proyecto(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_all_proyectos_new() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_all_proyectos_new(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_all_proyectos() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_all_proyectos(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}
function get_proyectos() {
  let _state = ObraPublica._getState();

  if (!_state && ObraPublica._requireInit()) {
    throw new Error("Contract must be initialized");
  }

  let _contract = ObraPublica._create();

  if (_state) {
    ObraPublica._reconstruct(_contract, _state);
  }

  let _args = ObraPublica._getArgs();

  let _result = _contract.get_proyectos(_args);
  if (_result !== undefined) if (_result && _result.constructor && _result.constructor.name === "NearPromise") _result.onReturn();else env.value_return(ObraPublica._serialize(_result));
}

function assert(statement, message) {
  if (!statement) {
    throw Error(`Assertion failed: ${message}`);
  }
}

export { add_licitacion, add_obra, estado_licitacion, estado_obra, evaluar_licitacion, get_all_proyectos, get_all_proyectos_new, get_arancel, get_cantidad_proyectos, get_licitacion, get_licitaciones_activas, get_mis_licitaciones, get_proyecto, get_proyectos, get_titular, limpia_proyectos, modifica_arancel, modifica_titular };
//# sourceMappingURL=obra_publica.js.map
