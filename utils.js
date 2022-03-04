module.exports = {
    isObject(obj) {
        return !this.isNull(obj) && typeof obj === 'object';
    },
    isString(obj) {
        return !this.isNull(obj) && typeof obj === 'string';
    },
    isNumber(obj) {
        return !this.isNull(obj) && typeof obj === 'number' && obj !== NaN;
    },
    isNull(obj) {
        return obj === null || obj === undefined;
    },
    clamp(n, b, t) {
        return Math.min(t, Math.max(b, n))
    }
}