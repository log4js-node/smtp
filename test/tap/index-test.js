'use strict';

const test = require('tap').test;
const sandbox = require('@log4js-node/sandboxed-module');
const appender = require('../../lib');

function setupLogging(category, options, errorOnSend, dontSendMail, errorOnConnect) {
  const msgs = [];

  const fakeMailer = {
    createTransport: function (name, opts) {
      return {
        config: opts,
        sendMail: function (msg, callback) {
          if (errorOnSend) {
            callback({ message: errorOnSend });
            return;
          }
          if (!dontSendMail) {
            msgs.push(msg);
            callback(null, true);
          }
        },
        on: function (type, callback) {
          if (type === 'error' && errorOnConnect) {
            callback({ message: errorOnConnect });
          }
        },
        close: function () {
        }
      };
    }
  };

  const layout = (e) => e.data[0];

  const fakeLayouts = {
    layout: function (type, config) {
      this.type = type;
      this.config = config;
      return layout;
    },
    basicLayout: layout,
    messagePassThroughLayout: layout
  };

  const fakeConsole = {
    errors: [],
    error: function (msg, value) {
      this.errors.push({ msg: msg, value: value });
    }
  };

  const appenderModule = sandbox.require('../../lib/', {
    requires: {
      nodemailer: fakeMailer
    },
    globals: {
      console: fakeConsole
    }
  });

  const app = appenderModule.configure(options, fakeLayouts);

  return {
    appender: app,
    mailer: fakeMailer,
    layouts: fakeLayouts,
    console: fakeConsole,
    results: msgs
  };
}

function checkMessages(assert, result, sender, subject) {
  result.results.forEach((msg, i) => {
    assert.equal(msg.from, sender);
    assert.equal(msg.to, 'recipient@domain.com');
    assert.equal(msg.subject, subject || `Log event #${i + 1}`);
    assert.ok(new RegExp(`.*Log event #${i + 1}\n$`).test(msg.text));
  });
}

function logEvent(message) {
  return { data: [message] };
}

test('log4js smtpAppender', (batch) => {
  batch.test('module should export configure function', (t) => {
    t.type(appender.configure, 'function');
    t.end();
  });

  batch.test('on error', (t) => {
    const setup = setupLogging('on error', {
      recipients: 'recipient@domain.com',
      sendInterval: 0,
      SMTP: { port: 25, auth: { user: 'user@domain.com' } }
    }, false, true, 'on error');

    setup.appender(logEvent('This will break'));

    t.test('should be logged to console', (assert) => {
      assert.equal(setup.console.errors.length, 1);
      assert.equal(setup.console.errors[0].msg, 'log4js.smtpAppender - Error happened');
      assert.equal(setup.console.errors[0].value.message, 'on error');
      assert.end();
    });
    t.end();
  });

  batch.test('minimal config', (t) => {
    const setup = setupLogging('minimal config', {
      recipients: 'recipient@domain.com',
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setup.appender(logEvent('Log event #1'));

    t.equal(setup.results.length, 1, 'should be one message only');
    checkMessages(t, setup);
    t.end();
  });

  batch.test('fancy config', (t) => {
    const setup = setupLogging('fancy config', {
      recipients: 'recipient@domain.com',
      sender: 'sender@domain.com',
      subject: 'This is subject',
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setup.appender(logEvent('Log event #1'));

    t.equal(setup.results.length, 1, 'should be one message only');
    checkMessages(t, setup, 'sender@domain.com', 'This is subject');
    t.end();
  });

  batch.test('config with layout', (t) => {
    const setup = setupLogging('config with layout', {
      layout: {
        type: 'tester'
      }
    });
    t.equal(setup.layouts.type, 'tester', 'should configure layout');
    t.end();
  });

  batch.test('separate email for each event', (t) => {
    const setup = setupLogging('separate email for each event', {
      recipients: 'recipient@domain.com',
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setTimeout(() => {
      setup.appender(logEvent('Log event #1'));
    }, 0);
    setTimeout(() => {
      setup.appender(logEvent('Log event #2'));
    }, 500);
    setTimeout(() => {
      setup.appender(logEvent('Log event #3'));
    }, 1100);
    setTimeout(() => {
      t.equal(setup.results.length, 3, 'there should be three messages');
      checkMessages(t, setup);
      t.end();
    }, 3000);
  });

  batch.test('multiple events in one email', (t) => {
    const setup = setupLogging('multiple events in one email', {
      recipients: 'recipient@domain.com',
      sendInterval: 1,
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setTimeout(() => {
      setup.appender(logEvent('Log event #1'));
    }, 0);
    setTimeout(() => {
      setup.appender(logEvent('Log event #2'));
    }, 100);
    setTimeout(() => {
      setup.appender(logEvent('Log event #3'));
    }, 1500);
    setTimeout(() => {
      t.equal(setup.results.length, 2, 'there should be two messages');
      t.equal(setup.results[0].to, 'recipient@domain.com');
      t.equal(setup.results[0].subject, 'Log event #1');
      t.equal(
        setup.results[0].text.match(/.*Log event #[1-2]$/gm).length,
        2
      );
      t.equal(setup.results[1].to, 'recipient@domain.com');
      t.equal(setup.results[1].subject, 'Log event #3');
      t.ok(/.*Log event #3\n$/.test(setup.results[1].text));
      t.end();
    }, 3000);
  });

  batch.test('error when sending email', (t) => {
    const setup = setupLogging('error when sending email', {
      recipients: 'recipient@domain.com',
      sendInterval: 0,
      SMTP: { port: 25, auth: { user: 'user@domain.com' } }
    }, 'oh noes');

    setup.appender(logEvent('This will break'));

    t.test('should be logged to console', (assert) => {
      assert.equal(setup.console.errors.length, 1);
      assert.equal(setup.console.errors[0].msg, 'log4js.smtpAppender - Send mail error happened');
      assert.equal(setup.console.errors[0].value.message, 'oh noes');
      assert.end();
    });
    t.end();
  });

  batch.test('transport full config', (t) => {
    const setup = setupLogging('transport full config', {
      recipients: 'recipient@domain.com',
      transport: {
        plugin: 'sendmail',
        options: {
          path: '/usr/sbin/sendmail'
        }
      }
    });
    setup.appender(logEvent('Log event #1'));

    t.equal(setup.results.length, 1, 'should be one message only');
    checkMessages(t, setup);
    t.end();
  });

  batch.test('transport no-options config', (t) => {
    const setup = setupLogging('transport no-options config', {
      recipients: 'recipient@domain.com',
      transport: {
        plugin: 'sendmail'
      }
    });
    setup.appender(logEvent('Log event #1'));

    t.equal(setup.results.length, 1, 'should be one message only');
    checkMessages(t, setup);
    t.end();
  });

  batch.test('transport no-plugin config', (t) => {
    const setup = setupLogging('transport no-plugin config', {
      recipients: 'recipient@domain.com',
      transport: {}
    });
    setup.appender(logEvent('Log event #1'));

    t.equal(setup.results.length, 1, 'should be one message only');
    checkMessages(t, setup);
    t.end();
  });

  batch.test('cc/bcc config', (t) => {
    const setup = setupLogging('cc config', {
      recipients: 'recipient@domain.com',
      cc: 'cc.recipient@domain.com',
      bcc: 'bcc.recipient@domain.com',
    });
    setup.appender(logEvent('Log event #1'));

    t.equal(setup.results.length, 1, 'should be one message only');
    t.equal(setup.results[0].cc, 'cc.recipient@domain.com');
    t.equal(setup.results[0].bcc, 'bcc.recipient@domain.com');
    checkMessages(t, setup);
    t.end();
  });

  batch.test('attachment config', (t) => {
    const setup = setupLogging('attachment config', {
      recipients: 'recipient@domain.com',
      attachment: {
        enable: true
      },
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setup.appender(logEvent('Log event #1'));

    t.test('message should contain proper data', (assert) => {
      assert.equal(setup.results.length, 1);
      assert.equal(setup.results[0].attachments.length, 1);
      const attachment = setup.results[0].attachments[0];
      assert.equal(setup.results[0].text, 'See logs as attachment');
      assert.equal(attachment.filename, 'default.log');
      assert.equal(attachment.contentType, 'text/x-log');
      assert.ok(new RegExp(`.*Log event #${1}\n$`).test(attachment.content));
      assert.end();
    });
    t.end();
  });

  batch.test('should support html emails', (t) => {
    const setup = setupLogging('html config', {
      recipients: 'recipient@domain.com',
      html: true
    });
    setup.appender(logEvent('Log event #1'));
    t.test('message should contain proper data', (assert) => {
      assert.equal(setup.results.length, 1);
      assert.match(setup.results[0].html, /Log event #1\n$/);
      assert.end();
    });
    t.end();
  });

  batch.test('should support html emails with attachments', (t) => {
    const setup = setupLogging('html attachment config', {
      recipients: 'recipient@domain.com',
      html: true,
      attachment: {
        enable: true
      },
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setup.appender(logEvent('Log event #1'));

    t.test('message should contain proper data', (assert) => {
      assert.equal(setup.results.length, 1);
      assert.equal(setup.results[0].attachments.length, 1);
      const attachment = setup.results[0].attachments[0];
      assert.equal(setup.results[0].html, 'See logs as attachment');
      assert.equal(attachment.filename, 'default.log');
      assert.equal(attachment.contentType, 'text/x-log');
      assert.ok(new RegExp(`.*Log event #${1}\n$`).test(attachment.content));
      assert.end();
    });
    t.end();
  });

  batch.test('should wait to send remaining emails on shutdown', (t) => {
    const setup = setupLogging('shutdown timeout', {
      recipients: 'recipient@domain.com',
      sendInterval: 30,
      shutdownTimeout: 1,
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    setup.appender(logEvent('Log event #1'));
    t.equal(setup.results.length, 0, 'should not be any messages yet');

    setup.appender.shutdown(() => {
      t.test('message should contain proper data', (assert) => {
        assert.equal(setup.results.length, 1);
        assert.match(setup.results[0].text, /Log event #1\n$/);
        assert.end();
      });
      t.end();
    });
  });

  batch.test('should only wait a specified time for sending remaining emails', (t) => {
    const setup = setupLogging('shutdown timeout without sending mails', {
      recipients: 'recipient@domain.com',
      sendInterval: 30,
      shutdownTimeout: 1,
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    }, false, true);
    setup.appender(logEvent('Log event #1'));
    t.equal(setup.results.length, 0, 'should not be any messages yet');

    setup.appender.shutdown(() => {
      t.equal(setup.results.length, 0);
      t.end();
    });
  });

  batch.test('should not break if shutdown called when no messages to send', (t) => {
    const setup = setupLogging('shutdown with no mail to send', {
      recipients: 'recipient@domain.com',
      sendInterval: 30,
      shutdownTimeout: 1,
      SMTP: {
        port: 25,
        auth: {
          user: 'user@domain.com'
        }
      }
    });
    t.equal(setup.results.length, 0, 'should not be any messages yet');

    setup.appender.shutdown(() => {
      t.equal(setup.results.length, 0);
      t.end();
    });
  });
  batch.end();
});
