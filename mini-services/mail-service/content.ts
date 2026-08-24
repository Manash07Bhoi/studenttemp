// Mock email content generator for StudentTemp
// Generates realistic Indian-student-themed emails: OTP codes, registration confirmations,
// newsletters, social notifications, shopping, security alerts.

export interface GeneratedEmail {
  fromEmail: string;
  fromName: string;
  subject: string;
  previewText: string;
  bodyText: string;
  bodyHtml: string;
  category: string;
  hasAttachment: boolean;
  attachments: Array<{ name: string; size: number; type: string }>;
  spf: string;
  dkim: string;
  dmarc: string;
  externalResourcesBlocked: number;
}

const rand = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
const pickN = <T,>(arr: T[], n: number): T[] => {
  const copy = [...arr];
  const out: T[] = [];
  for (let i = 0; i < n && copy.length; i++) {
    out.push(copy.splice(Math.floor(Math.random() * copy.length), 1)[0]);
  }
  return out;
};

const otp = () => randInt(100000, 999999).toString();
const txnId = () => 'TXN' + randInt(100000000, 999999999);

const FIRST = ['Rahul', 'Priya', 'Arjun', 'Sneha', 'Vikram', 'Ananya', 'Karthik', 'Divya', 'Aditya', 'Pooja', 'Rohan', 'Meera', 'Sanjay', 'Kavya', 'Amit'];
const COLLEGES = ['IIT Bombay', 'NIT Trichy', 'BITS Pilani', 'Delhi University', 'VIT Vellore', 'Anna University', 'IIM Ahmedabad', 'Christ University'];

interface Template {
  weight: number;
  category: string;
  generate: () => GeneratedEmail;
}

const templates: Template[] = [
  // OTP / Verification — most common for temp mail users
  {
    weight: 30,
    category: 'otp',
    generate: () => {
      const code = otp();
      const services = [
        { name: 'ExamPrep Pro', email: 'noreply@examprep.in', subject: `Your verification code: ${code}` },
        { name: 'Scholarship Portal', email: 'no-reply@scholarships.gov.in', subject: `OTP for scholarship login: ${code}` },
        { name: 'CoachingAdda', email: 'verify@coachingadda.com', subject: `[OTP] Complete your signup — ${code}` },
        { name: 'CollegeFest Hub', email: 'team@collegefest.in', subject: `Verify your fest registration — ${code}` },
        { name: 'InternShare', email: 'mail@internshare.in', subject: `Your intern portal code: ${code}` },
        { name: 'BookMySeat', email: 'noreply@bookmyseat.in', subject: `Seat booking OTP: ${code}` },
        { name: 'SkillBridge', email: 'noreply@skillbridge.co.in', subject: `${code} is your SkillBridge code` },
      ];
      const s = rand(services);
      const name = rand(FIRST);
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: s.subject,
        previewText: `Hi ${name}, your one-time verification code is ${code}. It expires in 10 minutes.`,
        bodyText: `Hi ${name},\n\nYour one-time verification code is:\n\n${code}\n\nThis code will expire in 10 minutes. Do not share it with anyone.\n\nIf you didn't request this, please ignore this email.\n\n— ${s.name} Team`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#4f46e5;margin-bottom:24px">${s.name}</h2>
  <p style="font-size:16px;line-height:1.6">Hi ${name},</p>
  <p style="font-size:16px;line-height:1.6">Your one-time verification code is:</p>
  <div style="margin:24px 0;text-align:center">
    <span style="display:inline-block;background:#eef2ff;color:#4f46e5;font-size:32px;font-weight:700;letter-spacing:8px;padding:16px 32px;border-radius:12px;border:2px dashed #4f46e5">${code}</span>
  </div>
  <p style="font-size:14px;color:#666;line-height:1.6">This code will expire in <strong>10 minutes</strong>. Please do not share it with anyone.</p>
  <p style="font-size:14px;color:#666;line-height:1.6">If you didn't request this code, you can safely ignore this email.</p>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">${s.name} • This is an automated message, please do not reply.</p>
</div>`,
        category: 'otp',
        hasAttachment: false,
        attachments: [],
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        externalResourcesBlocked: 0,
      };
    },
  },
  // Registration confirmation
  {
    weight: 18,
    category: 'registration',
    generate: () => {
      const services = [
        { name: 'CodingNinjas', email: 'welcome@codingninjas.in', event: 'Data Structures & Algorithms Bootcamp' },
        { name: 'Unacademy', email: 'team@unacademy.com', event: 'GATE 2026 Crash Course' },
        { name: 'PhysicsWallah', email: 'noreply@pw.live', event: 'JEE Mock Test Series' },
        { name: 'Testbook', email: 'mail@testbook.com', event: 'SSC CGL Complete Pack' },
        { name: 'Coursera', email: 'no-reply@coursera.org', event: 'Machine Learning Specialization' },
        { name: 'GeeksforGeeks', email: 'care@gfg.co', event: 'DSA Self-Paced Course' },
      ];
      const s = rand(services);
      const name = rand(FIRST);
      const orderId = 'ORD-' + randInt(100000, 999999);
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: `Registration confirmed — ${s.event}`,
        previewText: `Hi ${name}, your registration for ${s.event} is confirmed. Order ${orderId}.`,
        bodyText: `Hi ${name},\n\nGreat news! Your registration for "${s.event}" is confirmed.\n\nOrder ID: ${orderId}\nAccess: Login to your dashboard to start learning.\n\nNeed help? Reply to this email.\n\n— ${s.name} Team`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#10b981;margin-bottom:8px">${s.name}</h2>
  <p style="color:#666;margin-bottom:24px">Registration Confirmation</p>
  <h1 style="font-size:22px;margin-bottom:16px">You're all set, ${name}! 🎉</h1>
  <p style="font-size:16px;line-height:1.6">Your registration for <strong>${s.event}</strong> has been confirmed.</p>
  <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:24px 0">
    <p style="margin:0;color:#666;font-size:13px">Order ID</p>
    <p style="margin:4px 0 0 0;font-weight:700;font-size:18px;color:#15803d">${orderId}</p>
  </div>
  <p style="font-size:16px;line-height:1.6">Log in to your dashboard to start learning and access your course materials.</p>
  <div style="text-align:center;margin:24px 0">
    <a href="#" style="display:inline-block;background:#10b981;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Go to Dashboard</a>
  </div>
  <hr style="border:none;border-top:1px solid #eee;margin:24px 0">
  <p style="font-size:12px;color:#999">Need help? Reply to this email or visit our help center.</p>
</div>`,
        category: 'registration',
        hasAttachment: false,
        attachments: [],
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        externalResourcesBlocked: 2,
      };
    },
  },
  // Newsletter
  {
    weight: 12,
    category: 'newsletter',
    generate: () => {
      const newsletters = [
        { name: 'The Tech Brief', email: 'newsletter@techbrief.in', topic: 'AI in Education', author: 'Anjali Mehta' },
        { name: 'Campus Daily', email: 'hello@campusdaily.in', topic: 'Top 10 Internships This Week', author: 'Rohit Sharma' },
        { name: 'DevWeekly', email: 'weekly@devweekly.io', topic: 'Building Scalable APIs with Go', author: 'Priya Nair' },
      ];
      const n = rand(newsletters);
      const items = pickN([
        '5 resume mistakes that cost you interviews',
        'How to crack system design rounds',
        'The best free coding resources of 2026',
        'Internship stipends: what to expect',
        'Open source projects for beginners',
        'Remote vs onsite: which is right for you',
      ], 3);
      return {
        fromEmail: n.email,
        fromName: n.name,
        subject: `This week: ${n.topic} — ${n.name}`,
        previewText: `${items[0]} and more in this week's issue.`,
        bodyText: `${n.name}\nBy ${n.author}\n\nThis Week: ${n.topic}\n\nIn this issue:\n• ${items.join('\n• ')}\n\nRead the full issue at our website.\n\n— ${n.name}`,
        bodyHtml: `<div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="color:#c2410c;font-size:13px;letter-spacing:2px;margin-bottom:4px">${n.name.toUpperCase()}</p>
  <h1 style="font-size:28px;margin:0 0 8px 0;line-height:1.2">${n.topic}</h1>
  <p style="color:#666;font-style:italic;margin-bottom:32px">By ${n.author}</p>
  <p style="font-size:16px;line-height:1.7">In this week's issue:</p>
  <ul style="font-size:16px;line-height:1.8;padding-left:20px">
    ${items.map(i => `<li style="margin-bottom:8px"><a href="#" style="color:#c2410c;text-decoration:none">${i}</a></li>`).join('')}
  </ul>
  <p style="font-size:14px;color:#999;margin-top:32px">You're receiving this because you subscribed. <a href="#" style="color:#999">Unsubscribe</a></p>
</div>`,
        category: 'newsletter',
        hasAttachment: false,
        attachments: [],
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        externalResourcesBlocked: 5,
      };
    },
  },
  // Social notification
  {
    weight: 10,
    category: 'social',
    generate: () => {
      const socials = [
        { name: 'DevConnect', email: 'notify@devconnect.in', action: 'started following you' },
        { name: 'CodeHub', email: 'no-reply@codehub.io', action: 'liked your repository "snippet-share"' },
        { name: 'StudyBuddy', email: 'updates@studybuddy.in', action: 'sent you a study group invite' },
        { name: 'HackerRank', email: 'noreply@hackerrank.com', action: 'commented on your solution' },
      ];
      const s = rand(socials);
      const actor = rand(FIRST) + ' ' + ['Kumar', 'Sharma', 'Reddy', 'Iyer', 'Singh', 'Patel', 'Gupta', 'Das'][Math.floor(Math.random()*8)];
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: `${actor} ${s.action}`,
        previewText: `${actor} ${s.action} on ${s.name}. Tap to view.`,
        bodyText: `${actor} ${s.action}.\n\nView their profile and connect on ${s.name}.\n\n— ${s.name}`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="text-align:center;margin-bottom:24px">
    <div style="width:64px;height:64px;border-radius:50%;background:linear-gradient(135deg,#8b5cf6,#ec4899);margin:0 auto 16px;display:flex;align-items:center;justify-content:center;color:#fff;font-size:24px;font-weight:700">${actor[0]}</div>
    <p style="font-size:18px;margin:0"><strong>${actor}</strong></p>
    <p style="color:#666;margin:4px 0 0 0">${s.action}</p>
  </div>
  <div style="text-align:center;margin:24px 0">
    <a href="#" style="display:inline-block;background:#0ea5e9;color:#fff;padding:12px 32px;border-radius:24px;text-decoration:none;font-weight:600">View Profile</a>
  </div>
</div>`,
        category: 'social',
        hasAttachment: false,
        attachments: [],
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        externalResourcesBlocked: 1,
      };
    },
  },
  // Shopping / order
  {
    weight: 10,
    category: 'shopping',
    generate: () => {
      const stores = [
        { name: 'BookBazaar', email: 'orders@bookbazaar.in', item: 'Data Structures in Python (Textbook)', price: 449 },
        { name: 'TechMart', email: 'care@techmart.in', item: 'Mechanical Keyboard — RGB', price: 2199 },
        { name: 'StationeryHub', email: 'no-reply@stationeryhub.in', item: 'Notebook Set (5 pcs)', price: 299 },
        { name: 'GadgetWorld', email: 'orders@gadgetworld.in', item: 'Wireless Mouse', price: 699 },
      ];
      const s = rand(stores);
      const orderId = 'ORD' + randInt(100000, 999999);
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: `Order confirmed: ${s.item} — ₹${s.price}`,
        previewText: `Thank you for your order. Order ${orderId}. Expected delivery in 3-5 days.`,
        bodyText: `Order Confirmation\n\nOrder ID: ${orderId}\nItem: ${s.item}\nAmount: ₹${s.price}\n\nExpected delivery: 3-5 business days.\n\n— ${s.name}`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:#f59e0b;margin-bottom:8px">${s.name}</h2>
  <p style="color:#666;margin-bottom:24px">Order Confirmation</p>
  <h1 style="font-size:22px;margin-bottom:16px">Thanks for your order! 📦</h1>
  <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0">
    <table style="width:100%;font-size:14px">
      <tr><td style="color:#666;padding:4px 0">Order ID</td><td style="font-weight:700;text-align:right">${orderId}</td></tr>
      <tr><td style="color:#666;padding:4px 0">Item</td><td style="text-align:right">${s.item}</td></tr>
      <tr><td style="color:#666;padding:4px 0">Amount</td><td style="font-weight:700;text-align:right;color:#d97706">₹${s.price}</td></tr>
      <tr><td style="color:#666;padding:4px 0">Delivery</td><td style="text-align:right">3-5 business days</td></tr>
    </table>
  </div>
</div>`,
        category: 'shopping',
        hasAttachment: false,
        attachments: [],
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        externalResourcesBlocked: 0,
      };
    },
  },
  // Security alert (sometimes failing auth)
  {
    weight: 8,
    category: 'security',
    generate: () => {
      const pass = Math.random() > 0.3;
      const services = [
        { name: 'CloudVault', email: 'security@cloudvault.io' },
        { name: 'SecurePass', email: 'no-reply@securepass.in' },
        { name: 'AuthGuard', email: 'alerts@authguard.io' },
      ];
      const s = rand(services);
      const ip = `${randInt(1, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: pass ? 'New sign-in detected' : '⚠️ Suspicious sign-in attempt blocked',
        previewText: pass ? `A new sign-in from ${ip} was allowed.` : `We blocked a sign-in attempt from ${ip}.`,
        bodyText: pass
          ? `New sign-in detected\n\nIP: ${ip}\nTime: just now\n\nIf this was you, no action needed. If not, secure your account.`
          : `Suspicious sign-in blocked\n\nWe blocked a sign-in attempt from ${ip}.\n\nIf this was you, try again from a trusted device.`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <h2 style="color:${pass ? '#10b981' : '#ef4444'};margin-bottom:8px">${s.name} Security</h2>
  <h1 style="font-size:22px;margin-bottom:16px">${pass ? 'New sign-in detected' : '⚠️ Suspicious sign-in blocked'}</h1>
  <p style="font-size:16px;line-height:1.6">${pass ? 'A new device signed in to your account.' : 'We blocked an unusual sign-in attempt.'}</p>
  <div style="background:#f9fafb;border-radius:12px;padding:20px;margin:24px 0;font-size:14px">
    <p style="margin:0 0 8px 0"><strong>IP Address:</strong> ${ip}</p>
    <p style="margin:0"><strong>Time:</strong> Just now</p>
  </div>
  <p style="font-size:14px;color:#666">${pass ? 'If this was you, no action is needed.' : 'If this was you, try signing in from a trusted device.'}</p>
</div>`,
        category: 'security',
        hasAttachment: false,
        attachments: [],
        spf: pass ? 'pass' : 'fail',
        dkim: pass ? 'pass' : 'none',
        dmarc: pass ? 'pass' : 'fail',
        externalResourcesBlocked: 0,
      };
    },
  },
  // Email with attachment
  {
    weight: 6,
    category: 'general',
    generate: () => {
      const senders = [
        { name: 'Prof. ' + rand(FIRST) + ' ' + ['Rao', 'Nair', 'Reddy', 'Iyer'][Math.floor(Math.random()*4)], email: 'faculty@college.edu.in' },
        { name: 'Placement Cell', email: 'placements@campusmail.in' },
        { name: 'Library', email: 'library@campusmail.in' },
      ];
      const s = rand(senders);
      const attachments = [
        { name: 'assignment.pdf', size: 248000, type: 'application/pdf' },
        { name: 'syllabus.pdf', size: 156000, type: 'application/pdf' },
        { name: 'report.docx', size: 89000, type: 'application/vnd.openxmlformats' },
      ].slice(0, randInt(1, 2));
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: rand([
          'Assignment submission guidelines',
          'Updated syllabus attached',
          'Placement drive — register now',
          'Library overdue notice',
          'Workshop materials attached',
        ]),
        previewText: 'Please find the attached document for your reference.',
        bodyText: `Hello,\n\nPlease find the attached document for your reference.\n\nRegards,\n${s.name}`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <p style="font-size:16px;line-height:1.6">Hello,</p>
  <p style="font-size:16px;line-height:1.6">Please find the attached document for your reference. Let me know if you have any questions.</p>
  <div style="margin:24px 0">
    ${attachments.map(a => `
    <div style="display:flex;align-items:center;gap:12px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px 16px;margin-bottom:8px">
      <div style="width:32px;height:32px;background:#fee2e2;border-radius:6px;display:flex;align-items:center;justify-content:center;color:#dc2626;font-weight:700;font-size:11px">PDF</div>
      <div style="flex:1">
        <p style="margin:0;font-weight:600;font-size:14px">${a.name}</p>
        <p style="margin:0;color:#999;font-size:12px">${(a.size/1024).toFixed(0)} KB</p>
      </div>
    </div>`).join('')}
  </div>
  <p style="font-size:16px;line-height:1.6">Regards,<br><strong>${s.name}</strong></p>
</div>`,
        category: 'general',
        hasAttachment: true,
        attachments,
        spf: 'pass',
        dkim: 'pass',
        dmarc: 'pass',
        externalResourcesBlocked: 0,
      };
    },
  },
  // Phishing-looking (for the report-abuse demo)
  {
    weight: 6,
    category: 'general',
    generate: () => {
      const spoofed = [
        { name: 'PayPaI Support', email: 'security@paypa1-verify.xyz' },
        { name: 'Bank Verify', email: 'no-reply@securebank-verify.tk' },
        { name: 'Scholarship Grant', email: 'grants@scholarship-gov.fake' },
      ];
      const s = rand(spoofed);
      return {
        fromEmail: s.email,
        fromName: s.name,
        subject: rand([
          'URGENT: Verify your account immediately',
          'Your account will be suspended — action required',
          'You have won a ₹50,000 scholarship — claim now',
          'Security alert: confirm your identity',
        ]),
        previewText: 'Click the link below to verify your account within 24 hours...',
        bodyText: `Dear User,\n\nWe detected unusual activity on your account. Please verify your identity within 24 hours to avoid suspension.\n\nClick here to verify: [suspicious-link]\n\n— ${s.name}`,
        bodyHtml: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#1a1a1a">
  <div style="background:#fef2f2;border:2px solid #ef4444;border-radius:8px;padding:16px;margin-bottom:24px">
    <p style="margin:0;color:#dc2626;font-weight:700">⚠ URGENT ACTION REQUIRED</p>
  </div>
  <p style="font-size:16px;line-height:1.6">Dear User,</p>
  <p style="font-size:16px;line-height:1.6">We detected unusual activity on your account. <strong>Please verify your identity within 24 hours</strong> to avoid permanent suspension.</p>
  <div style="text-align:center;margin:24px 0">
    <a href="#" style="display:inline-block;background:#ef4444;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600">Verify Account Now</a>
  </div>
  <p style="font-size:12px;color:#999">If you ignore this message, your account will be permanently deleted.</p>
</div>`,
        category: 'general',
        hasAttachment: false,
        attachments: [],
        spf: 'softfail',
        dkim: 'fail',
        dmarc: 'fail',
        externalResourcesBlocked: 3,
      };
    },
  },
];

const totalWeight = templates.reduce((s, t) => s + t.weight, 0);

export function generateEmail(): GeneratedEmail {
  let r = Math.random() * totalWeight;
  for (const t of templates) {
    r -= t.weight;
    if (r <= 0) return t.generate();
  }
  return templates[0].generate();
}
