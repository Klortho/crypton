/* Crypton Client, Copyright 2013 SpiderOak, Inc.
 *
 * This file is part of Crypton Client.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License. 
 *
*/

(function() {

'use strict';

var Inbox = crypton.Inbox = function Inbox (session) {
  this.session = session;
  this.rawMessages = [];
  this.messages = {};
  // XXXddahl: let's turn poll() off for now
  // this.poll();
};

Inbox.prototype.poll = function (callback) {
  var that = this;
  var url = crypton.url() + '/inbox?sid=' + crypton.sessionId;
  callback = callback || function () {};

  superagent.get(url)
    .withCredentials()
    .end(function (res) {
    if (!res.body || res.body.success !== true) {
      callback(res.body.error);
      return;
    }

    // should we merge or overwrite here?
    that.rawMessages = res.body.messages;
    that.parseRawMessages();
    if (callback) {
      callback(null, res.body.messages);
    }
  });
};

Inbox.prototype.list = function () {
  // TODO should we poll here?
  return this.messages;
};

Inbox.prototype.filter = function (criteria, callback) {
  criteria = criteria || {};

  async.filter(this.messages, function (message) {
    for (var i in criteria) {
      if (message[i] != criteria[i]) {
        return false;
      }
    }

    return true;
  }, function (messages) {
    callback(messages);
  });
};

Inbox.prototype.get = function (messageId, callback) {
  var cachedMessage = this.messages[messageId];
  if (cachedMessage) {
    callback(null, cachedMessage);
    return;
  }

  var that = this;
  var url = crypton.url() + '/inbox/' + messageId + '?sid=' + crypton.sessionId;
  callback = callback || function () {};

  superagent.get(url)
    .withCredentials()
    .end(function (res) {
    if (!res.body || res.body.success !== true) {
      callback(res.body.error);
      return;
    }

    var message = new crypton.Message(that.session, res.body.message);
    message.decrypt(function (err) {
      if (err) {
        console.error(err);
        return callback(err);
      }
      that.messages[message.id] = message;
      callback(null, message);
    });
  });
};

Inbox.prototype.delete = function (id, callback) {
  var chunk = {
    type: 'deleteMessage',
    messageId: id
  };

  // TODO handle errs
  var tx = new crypton.Transaction(this.session, function (err) {
    tx.save(chunk, function (err) {
      tx.commit(function (err) {
        callback();
      });
    });
  });
};

Inbox.prototype.getAllMetadata = function (callback) {
  var that = this;
  var url = crypton.url() + '/inbox-metadata?sid=' + crypton.sessionId;
  callback = callback || function () {};

  superagent.get(url)
    .withCredentials()
    // .set('X-Session-ID', crypton.sessionId)
    .end(function (res) {
    if (!res.body || res.body.success !== true) {
      callback(res.body.error);
      return;
    }
    callback(null, res.body.metadata);
    return;
  });
},

Inbox.prototype.clear = function (callback) {
  // start + commit tx
  var chunk = {
    type: 'clearInbox'
  };

  // TODO handle errs
  var tx = new crypton.Transaction(this.session, function (err) {
    tx.save(chunk, function (err) {
      tx.commit(function (err) {
        callback();
      });
    });
  });
};

Inbox.prototype.parseRawMessages = function () {
  var that = this;

  for (var i = 0; i < this.rawMessages.length; i++) {
    var rawMessage = this.rawMessages[i];

    if (this.messages[rawMessage.messageId]) {
      continue;
    }

    var message = new crypton.Message(this.session, rawMessage);
    message.decrypt(function (err) {
      // XXXddahl: fix this, check for error
      that.messages[message.messageId] = message;
    });
  }
};

})();
