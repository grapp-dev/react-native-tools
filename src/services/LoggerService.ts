import { Function, HashMap, Logger, Option, pipe } from 'effect';

const logger = Logger.make(options => {
  // const fiberId =
  //   options.fiberId._tag === 'Runtime' || options.fiberId._tag === 'None'
  //     ? `#${options.fiberId.id}`
  //     : undefined;
  const service = pipe(
    options.annotations,
    HashMap.get('service'),
    Option.map(name => {
      return `${name} `;
    }),
    Option.getOrElse(Function.constant('')),
  );
  const date = new Date(options.date);
  const ts = date.toLocaleString(['pl'], {
    timeStyle: 'medium',
  });
  const ms = date.getMilliseconds().toString().padStart(3, '0');
  const tag = [`${ts}.${ms}`, '#'].join(' ');

  const textMessage = Array.isArray(options.message)
    ? options.message.map(message =>
        typeof message === 'object' ? JSON.stringify(message, null, 2) : (message as unknown),
      )
    : typeof options.message === 'object'
      ? JSON.stringify(options.message, null, 2)
      : (options.message as unknown);

  const message = [tag, ' ', service, options.logLevel.label, ' ', textMessage]
    .filter(Boolean)
    .join('');

  console.log(message);
});

export const LoggerService = {
  layer: Logger.replace(Logger.defaultLogger, logger),
};
