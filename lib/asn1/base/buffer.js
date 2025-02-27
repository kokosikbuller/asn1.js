"use strict";

const inherits = require("inherits");
const Reporter = require("../base/reporter").Reporter;
const Buffer = require("buffer/").Buffer;
const isBuffer = require("is-buffer");

function DecoderBuffer(base, options) {
  Reporter.call(this, options);
  if (!isBuffer(base)) {
    this.error("Input not Buffer");
    return;
  }

  this.base = base;
  this.offset = 0;
  this.length = base.length;
}
inherits(DecoderBuffer, Reporter);
exports.DecoderBuffer = DecoderBuffer;

DecoderBuffer.isDecoderBuffer = function isDecoderBuffer(data) {
  if (data instanceof DecoderBuffer) {
    return true;
  }

  // Or accept compatible API
  const isCompatible =
    typeof data === "object" &&
    isBuffer(data.base) &&
    data.constructor.name === "DecoderBuffer" &&
    typeof data.offset === "number" &&
    typeof data.length === "number" &&
    typeof data.save === "function" &&
    typeof data.restore === "function" &&
    typeof data.isEmpty === "function" &&
    typeof data.readUInt8 === "function" &&
    typeof data.skip === "function" &&
    typeof data.raw === "function";

  return isCompatible;
};

DecoderBuffer.prototype.save = function save() {
  return { offset: this.offset, reporter: Reporter.prototype.save.call(this) };
};

DecoderBuffer.prototype.restore = function restore(save) {
  // Return skipped data
  const res = new DecoderBuffer(this.base);
  res.offset = save.offset;
  res.length = this.offset;

  this.offset = save.offset;
  Reporter.prototype.restore.call(this, save.reporter);

  return res;
};

DecoderBuffer.prototype.isEmpty = function isEmpty() {
  return this.offset === this.length;
};

DecoderBuffer.prototype.readUInt8 = function readUInt8(fail) {
  if (this.offset + 1 <= this.length)
    return this.base.readUInt8(this.offset++, true);
  else return this.error(fail || "DecoderBuffer overrun");
};

DecoderBuffer.prototype.skip = function skip(bytes, fail) {
  if (!(this.offset + bytes <= this.length))
    return this.error(fail || "DecoderBuffer overrun");

  const res = new DecoderBuffer(this.base);

  // Share reporter state
  res._reporterState = this._reporterState;

  res.offset = this.offset;
  res.length = this.offset + bytes;
  this.offset += bytes;
  return res;
};

DecoderBuffer.prototype.raw = function raw(save) {
  return this.base.slice(save ? save.offset : this.offset, this.length);
};

function EncoderBuffer(value, reporter) {
  if (Array.isArray(value)) {
    this.length = 0;
    this.value = value.map(function (item) {
      if (!EncoderBuffer.isEncoderBuffer(item))
        item = new EncoderBuffer(item, reporter);
      this.length += item.length;
      return item;
    }, this);
  } else if (typeof value === "number") {
    if (!(0 <= value && value <= 0xff))
      return reporter.error("non-byte EncoderBuffer value");
    this.value = value;
    this.length = 1;
  } else if (typeof value === "string") {
    this.value = value;
    this.length = Buffer.byteLength(value);
  } else if (Buffer.isBuffer(value)) {
    this.value = value;
    this.length = value.length;
  } else {
    return reporter.error("Unsupported type: " + typeof value);
  }
}
exports.EncoderBuffer = EncoderBuffer;

EncoderBuffer.isEncoderBuffer = function isEncoderBuffer(data) {
  if (data instanceof EncoderBuffer) {
    return true;
  }

  // Or accept compatible API
  const isCompatible =
    typeof data === "object" &&
    data.constructor.name === "EncoderBuffer" &&
    typeof data.length === "number" &&
    typeof data.join === "function";

  return isCompatible;
};

EncoderBuffer.prototype.join = function join(out, offset) {
  if (!out) out = Buffer.alloc(this.length);
  if (!offset) offset = 0;

  if (this.length === 0) return out;

  if (Array.isArray(this.value)) {
    this.value.forEach(function (item) {
      item.join(out, offset);
      offset += item.length;
    });
  } else {
    if (typeof this.value === "number") out[offset] = this.value;
    else if (typeof this.value === "string") out.write(this.value, offset);
    else if (isBuffer(this.value)) this.value.copy(out, offset);
    offset += this.length;
  }

  return out;
};
