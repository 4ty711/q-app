var kju = new KJU();

var isObject = (a) => {
    return (!!a) && (a.constructor === Object);
};

const tokenDefinitions = [
    new SimpleLexer.Matcher().start(/^\s+$/),
    new SimpleLexer.Matcher().start(/,|\/|\.|-|;|:|_|\\|\^|\+|#|&|%|\?|@|\$/),
    new SimpleLexer.Matcher().start(/\w/).next(/\w/),
    SimpleLexer.TokenFactory({ type: 'reciever', ignore: true }, true).start(/\(/).next(/.|\s/).end(/\)/),
];

var app = new Vue({
    el: '#app',
    watch: {
        newMessageShown(val) {
            if (val) document.getElementById('contentInput').focus();
        },
        darkMode(val) {
            localStorage['darkMode'] = val;
        }
    },
    computed: {
        myMessages() {
            var arr = [];
            this.messages.forEach(m => {
                if (m.mine) arr.push(m);
            })
            return arr;
        },
        redeemedMessages() {
            var arr = [];
            this.messages.forEach(m => {
                if (m.redeemed) arr.push(m);
            })
            return arr;
        },
        newMessages() {
            var arr = [];
            this.messages.forEach(m => {
                if (!m.redeemed) arr.push(m);
            })
            return arr;
        },
        showPersonalToken(val) {
            if (!val) {
                if (this.qrCodeShown) {
                    this.tokenQRCode.clear();
                    this.qrCodeShown = false;
                }
            }
        }
    },
    data: () => {
        return {
            tokenQRCode: null,
            redeemedMessagesShown: 1,
            qrCodeShown: false,
            tokenRequested: 0,
            darkMode: 1,
            me: null,
            showMe: false,
            personalToken: null,
            showPersonalToken: false,
            newMessageResponse: "",
            newMessage: {
                content: "",
                reciever: "",
                responses: []
            },
            newMessageShown: false,
            lastMessages: [],
            tags: [],
            messages: [],
            participants: [{
                    name: "benjamin.lotterer@spoo-group.com",
                    short: "BL"
                },
                {
                    name: "moritz.roessler@spoo-group.com",
                    short: "MR"
                }
            ]
        }
    },
    methods: {
        // API Functions
        createToken() {

            if (this.personalToken) {
                this.showPersonalToken = !this.showPersonalToken;
                return;
            }

            if (this.tokenRequested == 1) {
                this.showPersonalToken = true;
                return;
            }

            var me = prompt('Enter your email. Your token will be sent to you.');
            if (!me) return;

            if (!me.includes('@')) {
                this.personalToken = me;
                localStorage['personalToken'] = me;
                this.tokenRequested = 0;
                localStorage['tokenRequested'] = 0;
                return;
            }

            kju.personalToken({ contact: me }, token => {
                localStorage['tokenRequested'] = 1;
                this.tokenRequested = 1;
            })
        },
        enterToken() {

            if (this.personalToken) {
                this.showPersonalToken = !this.showPersonalToken;
                return;
            }

            if (this.tokenRequested == 1) {
                this.showPersonalToken = true;
                return;
            }

            var me = prompt('If you already have a token, enter it here');
            if (!me) return;

            if (!me.includes('@')) {
                this.personalToken = me;
                localStorage['personalToken'] = me;
                this.tokenRequested = 0;
                localStorage['tokenRequested'] = 0;
            }
        },
        scanToken() {

            const html5QrCode = new Html5Qrcode("reader");

            function stopScanner() {
                html5QrCode.stop().then(ignore => {
                    his.qrCodeScannerShown = false;
                }).catch(err => {

                });
            }

            Html5Qrcode.getCameras().then(devices => {

                var cameraId = null;

                console.log('devices', devices)

                this.qrCodeScannerShown = true

                if (devices && devices.length) {
                    cameraId = devices[devices.length - 1].id;
                }

                html5QrCode.start(
                        cameraId, {
                            fps: 10,
                            qrbox: 250
                        },
                        qrCodeMessage => {
                            console.log(`QR Code detected: ${qrCodeMessage}`);
                            this.personalToken = qrCodeMessage;
                            localStorage['personalToken'] = qrCodeMessage;
                            this.tokenRequested = 0;
                            localStorage['tokenRequested'] = 0;
                            stopScanner();
                        },
                        errorMessage => {
                            console.log(`QR Code no longer in front of camera.`);
                        })
                    .catch(err => {
                        console.log(`Unable to start scanning, error: ${err}`);
                    });
            }).catch(err => {
                // handle err  
                console.log(err)
            });

        },
        createMessageWithReciever(msg) {
            var reciever = prompt('Email Reciever');
            if (!reciever) return;
            this.createMessage(msg);
        },
        getMessages(type, page, cb) {

            kju.getMessages({
                token: this.personalToken,
                type: 'recieved',
                $page: page || 1
            }, data => {
                if (cb) cb(data);
            })
        },
        createMessage(msg) {

            const lexer = SimpleLexer.Lexer(tokenDefinitions);
            const lexerResult = lexer(msg.content);

            var originalContent = msg.content;
            var content = "";
            var responses = [];
            var reciever = "";

            lexerResult.forEach((token, i) => {
                if (isObject(token)) {
                    if (token.type == 'reciever') reciever += token.value.replace('(', '').replace(')', '');
                } else if (token == '#') {
                    responses.push({ title: lexerResult[i + 1] });
                    lexerResult.splice(i + 1, 1)
                } else {
                    content += token
                }
            })

            if (content) msg.content = content;
            if (responses.length > 0) msg.responses = responses;
            if (reciever) msg.reciever = reciever;

            kju.createMessage({
                msg: {
                    content: msg.content,
                    reciever: msg.reciever,
                    responses: msg.responses
                },
                token: this.personalToken
            }, data => {

                data.mine = true;
                data.originalContent = originalContent;

                fs.writeFile('/q/' + data._id, JSON.stringify(data), {}, (err, d) => {
                    if (!err) {
                        this.newMessage = {};
                        this.messages.unshift(data)
                    }
                })

            })
        },

        redeemResponse(msg, respId) {
            kju.redeemResponse({
                msgId: msg._id,
                respId: respId,
                token: msg.consumerToken
            }, data => {
                console.log(data);
                this.messages.forEach((_msg, i) => {
                    if (_msg._id == msg._id) {
                        Vue.set(_msg, 'redeemed', true);
                        Vue.set(msg, 'redeemed', true);
                        fs.writeFile('/q/' + _msg._id, JSON.stringify(_msg), {}, (err, d) => {
                            if (!err) {
                                Vue.set(msg, 'redeemed', true);
                            }
                        })
                    }
                })
            })
        },

        deleteMessage(msgId) {
            if (!confirm('Really delete?')) return;

            kju.deleteMessage({
                msgId: msgId,
                token: this.personalToken
            }, data => {
                fs.unlink('/q/' + msgId, {}, (err, data) => {
                    this.messages.forEach((msg, i) => {
                        if (msg._id == msgId) this.messages.splice(i, 1);
                    })
                })
            })
        },

        // Frontend Functions
        generateQRCodeForToken() {

            this.tokenQRCode = new QRCode(document.getElementById("qrcode"), this.personalToken);
            this.qrCodeShown = true;
        },
        makeShortName(contact) {
            if (contact.includes('.')) {
                var parts = contact.split('.');
                return (parts[0] || 'X').charAt(0) + (parts[1] || 'Y').charAt(0);
            }
        },
        toggleRedeemedMessagesShown() {
            if (this.redeemedMessagesShown == 1) this.redeemedMessagesShown = 0
            else this.redeemedMessagesShown = 1;

            localStorage['redeemedMessagesShown'] = this.redeemedMessagesShown;
        },
        openMessage() {
            var msgLink = prompt('message link');
        },
        deletePersonalToken() {
            if (confirm('Really delete?'))
                this.personalToken = null;

            delete localStorage['personalToken'];
            this.showPersonalToken = false;
            delete localStorage['tokenRequested'];
            this.tokenRequested = false;
        },
        savePersonalToken(token) {
            this.personalToken = token;
            localStorage['personalToken'] = token;
            this.tokenRequested = 0;
            localStorage['tokenRequested'] = 0;
            this.showPersonalToken = false;
        },
        deleteMe() {
            this.me = null;
            delete localStorage['me'];
            this.showMe = false;
        },
        setMe() {
            var me = prompt('enter email')
            this.me = me;
            localStorage['me'] = me;
            this.showMe = true;
        },
        addRecieverToNewMessage(evt) {
            this.newMessage.responses.push({ title: evt.target.value })
            this.newMessageResponse = null;
        },
        removeResponseFromNewMessage(title) {
            this.newMessage.responses.forEach((res, i) => {
                if (res.title == title) this.newMessage.responses.splice(i, 1);
            })
        },
        popResponseFromNewMessage(evt) {
            if (evt.target.value.length == 0) this.newMessage.responses.pop()
        }
    },
    created() {
        if (localStorage['personalToken']) Vue.set(this, 'personalToken', localStorage['personalToken']);
        if (localStorage['me']) Vue.set(this, 'me', localStorage['me']);
        if (localStorage['darkMode']) this.darkMode = localStorage['darkMode'];
        if (localStorage['redeemedMessagesShown']) this.redeemedMessagesShown = localStorage['redeemedMessagesShown'];
        if (localStorage['tokenRequested']) this.tokenRequested = localStorage['tokenRequested'];

        window.addEventListener('DOMContentLoaded', (event) => {

            var textAreas = [document.getElementById('contentInput')];

            Array.prototype.forEach.call(textAreas, function(elem) {
                elem.placeholder = elem.placeholder.replace(/\\n/g, '\n');
            });

            fs.mkdir('/q', {}, (err, data) => {
                if (!err) {
                    console.log(data)
                }
            })

            fs.readdir('/q', {}, (err, data) => {
                if (!err) {
                    var fullCounter = 0;

                    if (data.length == 0) {
                        this.getMessages('recieved', 1, messages => {
                            messages.forEach(msgRemote => {
                                msgRemote.senderShort = this.makeShortName(msgRemote.sender);
                                this.messages.unshift(msgRemote)
                            })
                        });
                    }

                    data.forEach((d, i) => {
                        fs.readFile('/q/' + d, { 'encoding': 'utf8' }, (err, file) => {
                            if (!err) {
                                var msg = JSON.parse(file);
                                if (msg.mine) msg.senderShort = 'me';
                                else msg.senderShort = "X";

                                this.messages.unshift(msg)

                                    ++fullCounter;

                                if (data.length == fullCounter) {
                                    if (this.personalToken) {
                                        this.getMessages('recieved', 1, messages => {
                                            messages.forEach(msgRemote => {
                                                msgRemote.senderShort = this.makeShortName(msgRemote.sender);
                                                var localMsg = this.messages.find(m => m._id == msgRemote._id);
                                                if (!localMsg) this.messages.unshift(msgRemote)
                                            })
                                        });
                                    }
                                }
                            }
                        })
                    })
                }
            })
        });
    }
})