const nodemailer = require('nodemailer');
const env = require('../config/env');

const subjectMap = {
  daily_inactivity: 'PlacePrep | Return to the work',
  pending_tasks: 'PlacePrep | Pending tasks are waiting',
  missed_streak: 'PlacePrep | The streak is gone',
  countdown_urgency: 'PlacePrep | Deadline pressure is rising',
  motivation: 'PlacePrep | Show up tonight',
};

let transporter = null;

function isEmailDeliveryReady() {
  return env.emailEnabled;
}

function getTransporter() {
  if (!isEmailDeliveryReady()) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  transporter = nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpSecure,
    auth: env.smtpUser
      ? {
          user: env.smtpUser,
          pass: env.smtpPass,
        }
      : undefined,
  });

  return transporter;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function compactText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function buildRoleLabel(context = {}) {
  return compactText(context.targetRole || 'Placement preparation');
}

function buildFocusLabel(context = {}, summary = {}) {
  return compactText(
    context.focusArea
    || summary?.coachProfile?.focusArea
    || summary?.coachProfile?.weakTopics?.[0]
    || 'placement prep'
  );
}

function buildWeakTopicsLabel(context = {}, summary = {}) {
  const topics = Array.isArray(context.weakTopics) && context.weakTopics.length
    ? context.weakTopics
    : summary?.coachProfile?.weakTopics || [];

  return topics.slice(0, 3).map((topic) => compactText(topic)).filter(Boolean).join(', ');
}

function buildNextTaskLabel(context = {}) {
  return compactText(context.nextTask?.title);
}

function renderNotificationTextLine(notification) {
  const headline = compactText(notification.metadata?.headline || notification.metadata?.title || '');
  const whyNow = compactText(notification.metadata?.whyNow || '');
  const actionText = compactText(notification.metadata?.actionText || '');

  return [
    headline ? `- ${headline}` : `- ${notification.message}`,
    notification.message ? `  ${notification.message}` : null,
    whyNow ? `  Why now: ${whyNow}` : null,
    actionText ? `  Next move: ${actionText}` : null,
  ].filter(Boolean).join('\n');
}

function buildDigestText(user, notifications, summary, context = {}) {
  const primary = notifications[0];
  const summaryLine = compactText(
    primary?.metadata?.summaryLine
    || context.summaryLine
    || summary?.coachProfile?.commandLine
  );
  const role = buildRoleLabel(context);
  const focus = buildFocusLabel(context, summary);
  const weakTopics = buildWeakTopicsLabel(context, summary);
  const nextTask = buildNextTaskLabel(context);

  return [
    `${user.name || user.username || 'PlacePrep user'},`,
    '',
    compactText(primary?.metadata?.headline || primary?.message || 'PlacePrep signal'),
    summaryLine || null,
    '',
    `Role: ${role}`,
    `Focus area: ${focus}`,
    weakTopics ? `Weak topics: ${weakTopics}` : null,
    nextTask ? `Next task: ${nextTask}` : null,
    '',
    ...notifications.map(renderNotificationTextLine),
    '',
    `Readiness: ${Math.round(Number(summary?.readinessScore || 0))}`,
    `Streak: ${Math.round(Number(summary?.streak || 0))}`,
    `Consistency: ${Math.round(Number(summary?.consistencyScore || 0))}`,
  ].join('\n');
}

function buildSignalChips(context = {}, summary = {}) {
  const chips = [
    buildRoleLabel(context),
    buildFocusLabel(context, summary),
    buildWeakTopicsLabel(context, summary),
    buildNextTaskLabel(context),
  ].filter(Boolean).slice(0, 4);

  return chips.map((chip) => `
    <span style="display:inline-block;margin:0 10px 10px 0;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#d7d2d2;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">
      ${escapeHtml(chip)}
    </span>
  `).join('');
}

function buildNotificationRows(notifications) {
  return notifications
    .map((notification) => `
      <tr>
        <td style="padding:0 0 18px 0;">
          <div style="padding:18px 18px 16px 18px;border:1px solid rgba(255,255,255,0.06);border-radius:18px;background:rgba(255,255,255,0.02);">
            <div style="color:#f2efef;font-size:18px;line-height:1.3;font-weight:600;">
              ${escapeHtml(notification.metadata?.headline || notification.metadata?.title || notification.message)}
            </div>
            <div style="margin-top:8px;color:#c8c2c2;font-size:14px;line-height:1.65;">
              ${escapeHtml(notification.message)}
            </div>
            ${notification.metadata?.whyNow ? `
              <div style="margin-top:12px;color:#9f9898;font-size:12px;line-height:1.5;letter-spacing:0.08em;text-transform:uppercase;">
                Why now
              </div>
              <div style="margin-top:4px;color:#d0cbcb;font-size:13px;line-height:1.55;">
                ${escapeHtml(notification.metadata.whyNow)}
              </div>
            ` : ''}
            ${notification.metadata?.actionText ? `
              <div style="margin-top:12px;color:#9f9898;font-size:12px;line-height:1.5;letter-spacing:0.08em;text-transform:uppercase;">
                Next move
              </div>
              <div style="margin-top:4px;color:#f2efef;font-size:13px;line-height:1.55;">
                ${escapeHtml(notification.metadata.actionText)}
              </div>
            ` : ''}
          </div>
        </td>
      </tr>
    `)
    .join('');
}

function buildDigestHtml(user, notifications, summary, context = {}) {
  const primary = notifications[0];
  const summaryLine = compactText(
    primary?.metadata?.summaryLine
    || context.summaryLine
    || summary?.coachProfile?.commandLine
  );
  const role = buildRoleLabel(context);
  const focus = buildFocusLabel(context, summary);
  const rows = buildNotificationRows(notifications);

  return `
    <div style="background:#0a0a0d;padding:32px 0;font-family:Inter,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width:560px;background:#111116;border:1px solid rgba(255,255,255,0.07);border-radius:22px;overflow:hidden;">
              <tr>
                <td style="padding:28px 30px 10px 30px;">
                  <div style="color:#9a9a9a;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;">PlacePrep Signal</div>
                  <h1 style="margin:14px 0 0 0;color:#f2efef;font-family:'Cormorant Garamond',Georgia,serif;font-size:42px;font-weight:500;line-height:1.05;">
                    ${escapeHtml(primary.metadata?.headline || primary.message)}
                  </h1>
                  ${summaryLine ? `
                    <div style="margin-top:12px;color:#c7c1c1;font-size:15px;line-height:1.7;">
                      ${escapeHtml(summaryLine)}
                    </div>
                  ` : ''}
                </td>
              </tr>
              <tr>
                <td style="padding:4px 30px 4px 30px;">
                  ${buildSignalChips(context, summary)}
                </td>
              </tr>
              <tr>
                <td style="padding:8px 30px 0 30px;">
                  <div style="padding:18px;border:1px solid rgba(255,255,255,0.06);border-radius:18px;background:linear-gradient(180deg, rgba(140,41,41,0.10), rgba(255,255,255,0.02));">
                    <div style="color:#9a9a9a;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;">Primary directive</div>
                    <div style="margin-top:10px;color:#f2efef;font-size:18px;line-height:1.55;">
                      ${escapeHtml(primary.message)}
                    </div>
                    ${primary.metadata?.actionText ? `
                      <div style="margin-top:12px;color:#d9d2d2;font-size:14px;line-height:1.6;">
                        ${escapeHtml(primary.metadata.actionText)}
                      </div>
                    ` : ''}
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 30px 0 30px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    ${rows}
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:8px 30px 28px 30px;">
                  <div style="border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;color:#9a9a9a;font-size:13px;line-height:1.8;">
                    <div>${escapeHtml(user.name || user.username || 'PlacePrep user')}</div>
                    <div>Role: ${escapeHtml(role)}</div>
                    <div>Focus: ${escapeHtml(focus)}</div>
                    <div>Readiness: ${Math.round(Number(summary?.readinessScore || 0))}</div>
                    <div>Streak: ${Math.round(Number(summary?.streak || 0))}</div>
                    <div>Consistency: ${Math.round(Number(summary?.consistencyScore || 0))}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildWelcomeText(user) {
  const name = user.name || user.username || 'PlacePrep user';
  const targetRole = compactText(user.targetRole || 'Placement preparation');
  const signInUrl = `${env.clientUrl}/auth?mode=login`;

  return [
    `${name},`,
    '',
    'Your PlacePrep system is ready.',
    '',
    `Role focus: ${targetRole}`,
    '',
    'Inside PlacePrep you can:',
    '- Build a roadmap with Prep Architect',
    '- Get direct guidance from Nocturne Mentor',
    '- Turn spare time into quick wins with Power Pocket',
    '- Track streak, consistency, and readiness',
    '',
    'Settings lets you configure:',
    '- Profile links and identity details',
    '- Notification channels',
    '- Avatar and account preferences',
    '',
    `Enter PlacePrep: ${signInUrl}`,
  ].join('\n');
}

function buildWelcomeHtml(user) {
  const name = user.name || user.username || 'PlacePrep user';
  const targetRole = compactText(user.targetRole || 'Placement preparation');
  const signInUrl = `${env.clientUrl}/auth?mode=login`;

  return `
    <div style="background:#0a0a0d;padding:32px 0;font-family:Inter,Arial,sans-serif;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" style="max-width:560px;background:#111116;border:1px solid rgba(255,255,255,0.07);border-radius:22px;overflow:hidden;">
              <tr>
                <td style="padding:30px 30px 14px 30px;">
                  <div style="color:#9a9a9a;font-size:11px;letter-spacing:0.32em;text-transform:uppercase;">PlacePrep</div>
                  <h1 style="margin:14px 0 0 0;color:#f2efef;font-family:'Cormorant Garamond',Georgia,serif;font-size:44px;font-weight:500;line-height:1.05;">
                    Welcome inside.
                  </h1>
                  <div style="margin-top:12px;color:#c7c1c1;font-size:15px;line-height:1.7;">
                    Your private placement system is active now. Keep the work exact.
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:4px 30px 0 30px;">
                  <span style="display:inline-block;margin:0 10px 10px 0;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#d7d2d2;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">
                    ${escapeHtml(targetRole)}
                  </span>
                  <span style="display:inline-block;margin:0 10px 10px 0;padding:9px 14px;border-radius:999px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:#d7d2d2;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">
                    Settings configurable
                  </span>
                </td>
              </tr>
              <tr>
                <td style="padding:14px 30px 0 30px;">
                  <div style="padding:18px;border:1px solid rgba(255,255,255,0.06);border-radius:18px;background:linear-gradient(180deg, rgba(140,41,41,0.10), rgba(255,255,255,0.02));">
                    <div style="color:#9a9a9a;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;">What is waiting</div>
                    <div style="margin-top:12px;color:#f2efef;font-size:15px;line-height:1.75;">
                      <div><strong>Prep Architect</strong>: build a roadmap instead of guessing.</div>
                      <div><strong>Nocturne Mentor</strong>: get direct, no-noise guidance.</div>
                      <div><strong>Power Pocket</strong>: turn spare minutes into progress.</div>
                      <div><strong>Progress</strong>: track streak, consistency, and readiness.</div>
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 30px 0 30px;">
                  <div style="padding:18px;border:1px solid rgba(255,255,255,0.06);border-radius:18px;background:rgba(255,255,255,0.02);">
                    <div style="color:#9a9a9a;font-size:11px;letter-spacing:0.28em;text-transform:uppercase;">Settings</div>
                    <div style="margin-top:12px;color:#d9d2d2;font-size:14px;line-height:1.75;">
                      Profile links, avatar, notification channels, and account details can all be adjusted in Settings.
                    </div>
                  </div>
                </td>
              </tr>
              <tr>
                <td style="padding:24px 30px 30px 30px;">
                  <a href="${escapeHtml(signInUrl)}" style="display:inline-block;padding:12px 18px;border-radius:999px;background:#8b0000;color:#f5eded;text-decoration:none;font-size:13px;letter-spacing:0.18em;text-transform:uppercase;">
                    Enter PlacePrep
                  </a>
                  <div style="margin-top:18px;border-top:1px solid rgba(255,255,255,0.08);padding-top:18px;color:#9a9a9a;font-size:13px;line-height:1.8;">
                    <div>${escapeHtml(name)}</div>
                    <div>Role: ${escapeHtml(targetRole)}</div>
                  </div>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

async function sendNotificationDigestEmail({ user, notifications, summary, context = {} }) {
  if (!notifications?.length) {
    return {
      attempted: false,
      sent: false,
      reason: 'no_notifications',
    };
  }

  if (!isEmailDeliveryReady()) {
    return {
      attempted: false,
      sent: false,
      reason: 'email_not_configured',
    };
  }

  try {
    const transport = getTransporter();
    const primary = notifications[0];

    await transport.sendMail({
      from: env.smtpFrom,
      to: user.email,
      subject: primary.metadata?.subject || subjectMap[primary.type] || 'PlacePrep | Mentor notice',
      text: buildDigestText(user, notifications, summary, context),
      html: buildDigestHtml(user, notifications, summary, context),
    });

    return {
      attempted: true,
      sent: true,
      reason: 'sent',
    };
  } catch (error) {
    console.error('[notifications] Failed to send email digest.', error);
    return {
      attempted: true,
      sent: false,
      reason: error?.message || 'email_failed',
    };
  }
}

async function sendWelcomeEmail({ user }) {
  if (!isEmailDeliveryReady()) {
    return {
      attempted: false,
      sent: false,
      reason: 'email_not_configured',
    };
  }

  try {
    const transport = getTransporter();

    await transport.sendMail({
      from: env.smtpFrom,
      to: user.email,
      subject: 'PlacePrep | Welcome inside',
      text: buildWelcomeText(user),
      html: buildWelcomeHtml(user),
    });

    return {
      attempted: true,
      sent: true,
      reason: 'sent',
    };
  } catch (error) {
    console.error('[auth] Failed to send welcome email.', error);
    return {
      attempted: true,
      sent: false,
      reason: error?.message || 'welcome_email_failed',
    };
  }
}

module.exports = {
  sendNotificationDigestEmail,
  sendWelcomeEmail,
  isEmailDeliveryReady,
};
