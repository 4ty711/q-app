/*
Simple Lexer by Moritz Roessler.
*/

const TokenFactory = (proto, assign) => new Matcher((value) => {
    if (typeof value === 'object') return value
    if (assign)
        return Object.assign({}, proto, {value})
    return Object.assign(Object.create(proto), {value})
});

class Token {
    constructor (props) {
        Object.assign(this, props);
    }
}

class Matcher {
    constructor (transform) {
        if (typeof transform === 'function')
            this._transform = transform
    }

    start (r) {
        this._start = r;
        return this;
    }

    next (r) {
        this._next = r;
        return this;
    }

    end (r) {
        this._end = r;
        return this;
    }

    while (r) {
        this._while = r;
        return this;
    }

    _test (obj, char)  {
        if (typeof obj === 'function')
            return obj(char);
        if (obj instanceof RegExp)
            return obj.test(char);
        return false;
    }

    test (char, token = '', hint)  {
        if (hint === null) return false;
        if (hint) return this._test(hint, char)
        if (this._start && !token) return this._test(this._start, char);
        if (this._next)  return this._test(this._next, char);
        if (this._while) return this._test(this._while, token + char);
        
        // if (this._end) return this._end && this._end.test(char);
        return false;
    }

    testEnd (char, token = '', hint)  {
        return this._end && this._end.test(char);

    }
    _transform (token) {
        return token;
    }

    transform (token) {
        return this._transform(token);
    }
}


const Lexer = (def) =>  (src) => {
    return src.split('').reduce((acc, char, i, arr) => {
        const [token, lastMatcher, tokens] = acc;
        const {_end = null} = lastMatcher; let ret; 
        if (lastMatcher.test(char, token, _end)) {
            ret = [lastMatcher.transform(token+char), new Matcher, tokens];
        } else if (lastMatcher.test(char, token)) {
            ret = [token+char, lastMatcher,tokens];
        } else {
            const matcher = def.find(matcher => matcher.test(char));
            if (!matcher) throw new Error(`No matcher found for character '${char}'.`);
            token && tokens.push(lastMatcher.transform(token));
            ret = [char, matcher, tokens];
        }

        if (i === arr.length - 1) {
            tokens.push(lastMatcher.transform(ret[0]));
            ret = tokens;
        }

        return ret;
    }, ['', new Matcher, []]);
}

SimpleLexer = {
	Lexer,
	TokenFactory,
	Matcher
}