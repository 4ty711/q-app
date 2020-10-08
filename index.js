var kju = new KJU();

var app = new Vue({
    el: '#app',
    watch: {
        newMessageShown(val) {
            console.log(this.$refs)
            if (val) document.getElementById('contentInput').focus();
        },
        darkMode(val){
            localStorage['darkMode'] = val;
        }
    },
    data: () => {
        return {
            darkMode:1,
            me: null,
            showMe: false,
            creationToken: null,
            showCreationToken: false,
            newMessageResponse: "",
            newMessage: {
                content: "",
                reciever: "",
                responses: []
            },
            newMessageShown: false,
            tags: ["boelling", "spoo"],
            messages: [
            ],
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

            if (this.creationToken) {
                this.showCreationToken = !this.showCreationToken;
                return;
            }

            var me = prompt('Enter your email. Your token will be sent to you');
            if (!me) return;

            kju.createToken(token => {
                localStorage['creationToken'] = token;
                this.creationToken = token;
            })
        },

        createMessageWithReciever(msg){
            var reciever=prompt('Email Reciever');
            if(!reciever) return;
            this.createMessage(msg);
        },
        createMessage(msg) {
            kju.createMessage({
                msg: {
                    content: msg.content,
                    reciever: msg.reciever,
                    responses: msg.responses
                },
                token: this.creationToken
            }, data => {

                data.mine = true;

                fs.writeFile('/q/' + data._id, JSON.stringify(data), {}, (err, d) => {
                    if (!err) {
                        this.messages.unshift(data)
                    }
                })

            })
        },

        redeemResponse(msgId, respId, token){
            kju.redeemResponse({
                msgId: msgId,
                respId: respId,
                token: token
            }, data => {
                console.log(data);
                this.messages.forEach((msg, i) => {
                    if(msg._id == msgId) {
                        msg.redeemed = true;
                        fs.writeFile('/q/' + msg._id, JSON.stringify(msg), {}, (err, d) => {
                            if (!err) {
                                
                            }
                        })
                    }
                }) 
            })
        },

        deleteMessage(msgId) {
            if(!confirm('Really delete?')) return;

            fs.unlink('/q/'+msgId, {}, (err, data) => {
                this.messages.forEach((msg, i) => {
                    if(msg._id == msgId) this.messages.splice(i);
                })  
            })

            kju.deleteMessage({
                msgId: msgId
            }, data => {
                fs.unlink('/q/'+msgId, {}, (err, data) => {
                    this.messages.forEach((msg, i) => {
                        if(msg._id == msgId) this.messages.splice(i);
                    })  
                })
            })
        },

        // Frontend Functions
        openMessage(){
            var msgLink = prompt('message link');
        },
        deleteCreationToken() {
            this.creationToken = null;
            delete localStorage['creationToken'];
            this.showCreationToken = false;
        },
        saveCreationToken(token) {
            this.creationToken = token;
            localStorage['creationToken'] = token;
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
        if (localStorage['creationToken']) Vue.set(this, 'creationToken', localStorage['creationToken']);
        if (localStorage['me']) Vue.set(this, 'me', localStorage['me']);
        if(localStorage['darkMode']) this.darkMode = localStorage['darkMode'];

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

                    data.forEach(d => {
                        fs.readFile('/q/' + d, { 'encoding': 'utf8' }, (err, file) => {
                            if (!err) {
                                var msg = JSON.parse(file);
                                if(msg.mine) msg.senderShort = 'me';
                                this.messages.unshift(msg)
                            }
                        })

                    })
                }
            })

        });
    }
})