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
    },
    rotateVector(vec, angle, inRadian = false) {
        if (!inRadian)
            angle = angle / (180 / Math.PI)

        let sin_b = Math.sin(angle);
        let cos_b = Math.cos(angle);

        return {
            x: vec.x * cos_b + vec.y * sin_b,
            y: -vec.x * sin_b + vec.y * cos_b
        }
    },
    vectorDirection(v, base) {
        var angle = (Math.atan2(v.y, v.x) - Math.atan2(base.y, base.x)) * 180 / Math.PI
        if (angle < -180) angle += 360
        if (angle > 180) angle -= 360
        return -angle
    },
    vectorLength(v) {
        return Math.sqrt(v.x ** 2 + v.y ** 2)
    },
    multVector(v, multiplier) {
        return {
            x: v.x * multiplier,
            y: v.y * multiplier
        }
    },
    sumVector(p, v) {
        return {
            x: p.x + v.x,
            y: p.y + v.y
        }
    },
    normalize(v) {
        let len = Math.sqrt(v.x ** 2 + v.y ** 2)
        return {
            x: v.x / len,
            y: v.y / len
        }
    },
    vectorFromPoints(start, end) {
        return {
            x: end.x - start.x,
            y: end.y - start.y,
        }
    },
    removeEdgeQuotes(s) {
        const quotes = '"\''
        let start = 0
        let end = s.length
        if (quotes.includes(s[0]))
            start = 1
        if (quotes.includes(s[s.length - 1]))
            end = s.length - 1
        return s.substring(start, end)
    }
}