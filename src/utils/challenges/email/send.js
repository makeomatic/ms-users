/**
 * Sends simple email using mailing microservice
 */
module.exports = async function definedSubjectAndSend(props, wait = false) {
  const {
    email, type, context, templateName, nodemailer = {},
  } = props;
  const { config, mailer } = this;
  const { validation } = config;
  const { subjects, senders, email: mailingAccount } = validation;

  const ctx = {
    nodemailer: {
      ...nodemailer,
      subject: subjects[type] || '',
      from: senders[type] || 'noreply <support@example.com>',
      to: email,
    },
    template: context,
  };

  const mailSent = mailer
    .sendTemplate(mailingAccount, templateName, ctx)
    .then(() => ({ sent: true, context }))
    .catch((err) => ({
      context,
      err,
      sent: false,
    }));

  if (wait) {
    return mailSent;
  }

  return {
    queued: true,
    context,
  };
};
