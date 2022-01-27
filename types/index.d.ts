// Type definitions for log4js SMTP appender

export interface BaseLayout {
  type: 'basic';
}

export interface ColoredLayout {
  type: 'colored' | 'coloured';
}

export interface MessagePassThroughLayout {
  type: 'messagePassThrough';
}

export interface DummyLayout {
  type: 'dummy';
}

export interface Level {
  isEqualTo(other: string): boolean;
  isEqualTo(otherLevel: Level): boolean;
  isLessThanOrEqualTo(other: string): boolean;
  isLessThanOrEqualTo(otherLevel: Level): boolean;
  isGreaterThanOrEqualTo(other: string): boolean;
  isGreaterThanOrEqualTo(otherLevel: Level): boolean;
  colour: string;
  level: number;
  levelStr: string;
}

export interface LoggingEvent {
  categoryName: string;  // name of category
  level: Level;  // level of message
  data: any[];  // objects to log
  startTime: Date;
  pid: number;
  context: any;
  cluster?: {
    workerId: number;
    worker: number;
  };
}

export type Token = ((logEvent: LoggingEvent) => string) | string;

export interface PatternLayout {
  type: 'pattern';
  // specifier for the output format, using placeholders as described below
  pattern: string;
  // user-defined tokens to be used in the pattern
  tokens?: { [name: string]: Token };
}

export interface CustomLayout {
  [key: string]: any;
  type: string;
}

export type Layout = BaseLayout | ColoredLayout | MessagePassThroughLayout | DummyLayout | PatternLayout | CustomLayout;

export interface SmtpAppender {
	type: '@log4js-node/smtp';
	// (if not present will use transport field)
	SMTP?: {
		// (defaults to localhost)
		host?: string;
		// (defaults to 25)
		port?: number;
		// authentication details
		auth?: {
			user: string;
			pass: string;
		};
	};
	// (if not present will use SMTP) - see nodemailer docs for transport options
	transport?: {
		// (defaults to smtp) - the nodemailer transport plugin to use
		plugin?: string;
		// configuration for the transport plugin
		options?: any;
	} | string;
	// send logs as email attachment
	attachment?: {
		// (defaults to false)
		enable?: boolean;
		// (defaults to See logs as attachment) - message to put in body of email
		message: string;
		// (defaults to default.log) - attachment filename
		filename: string;
	};
	// integer(defaults to 0) - batch emails and send in one email every sendInterval seconds, if 0 then every log message will send an email.
	sendInterval?: number;
	// (defaults to 5) - time in seconds to wait for emails to be sent during shutdown
	shutdownTimeout?: number;
	// email addresses to send the logs to
	recipients: string;
	// (defaults to message from first log event in batch) - subject for email
	subject?: string;
	// who the logs should be sent as
	sender?: string;
	// (defaults to false) - send the email as HTML instead of plain text
	html?: boolean;
	// (defaults to basicLayout)
	layout?: Layout;
	// email addresses to send the carbon-copy logs to
	cc?: string;
	// email addresses to send the blind-carbon-copy logs to
	bcc?: string;
}

export type Appender = SmtpAppender;
