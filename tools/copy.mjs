// (single source of truth for outreach copy - injected verbatim into index.html at build; keep browser-safe)
// __SHARED_COPY_START__

// CALENDAR LINK - deliberately NOT in the copy. The Gmail compose URL's &body= is plain text only:
// it cannot carry a hyperlink or italics, and any markup marker (_x_, *x*, [x](url)) renders
// literally in the draft. So each body ends on a bare localized call-to-action word on its own line
// (Book here / Reservez ici / Reserva aqui) which Santiago selects in Gmail and links + italicizes
// by hand. Do NOT "helpfully" paste the scheduler URL back in - per Santiago 2026-08-25.
const BOOK = { en: 'Book here', fr: 'Réservez ici', es: 'Reserva aquí' };

// Post-Qual follow-up copy, language-routed. Applies to the Post-Qual segment only.
// FR uses formal register (vous); ES uses informal register (tu). Deliberate per market.
// Signed off by Santiago Subra 2026-07-06. Used by the in-app compose link and Plan 4 auto-drafts.

export const POST_QUAL = {
  en: {
    subject: 'Following up after our call - CloudTalk',
    body: name => `Hi ${name},

Just wanted to follow up on the project after our call.

Is this still something of serious consideration?

If any questions came up on your end in the meantime, feel free to send them over and I'll clear them up.

A quick demo is also useful to clarify any grey areas - let me know if you'd be open to a quick interface run-through this week.

Best`
  },
  fr: {
    subject: 'Suite à notre échange - CloudTalk',
    body: name => `Bonjour ${name},

J'espère que vous allez bien.

Avez-vous eu le temps de réfléchir aux solutions évoquées pour votre configuration ?

Si le sujet est toujours d'actualité, je serais ravi de vous organiser une démo plus adaptée et de vous mettre en relation avec l'un de nos experts techniques, afin de vous montrer concrètement comment l'outil répond à vos besoins.

Je reste bien entendu à votre entière disposition si vous avez la moindre question d'ici là.

Bien cordialement,`
  },
  es: {
    subject: 'Seguimiento de nuestra conversación - CloudTalk',
    body: name => `Hola ${name},

Quería hacer un seguimiento sobre el plan y sobre las soluciones que comentamos para tu configuración.

La forma más fácil de ver si esto encaja es dedicar 30 minutos a revisar juntos tu configuración y mapearlo todo en vivo - así puedes ver exactamente cómo funcionaría para tu equipo. Eso suele aclarar bastante la decisión.

¿Te vendría bien esta semana o a inicios de la próxima?

Si mientras tanto te surgió alguna duda, mándamela sin problema y te la aclaro.

Espero tus comentarios,`
  }
};

// Working follow-up copy for leads that booked a meeting but did not reach qual.
// UI-only: used by the in-app compose link. FR formal (vous), ES peninsular informal (tu).
//
// FR GENDER TRAP - do NOT write `etre` + past participle about the recipient (e.g. "vous etiez
// interesse"), the participle agrees with their gender and templates cannot know it. Use `avoir`
// with a following object ("vous aviez manifeste de l'interet") or a noun construction instead.
// FR/ES house style here: no space before ? or :, and no opening inverted ¿ in Spanish -
// deliberate per Santiago 2026-08-25, reads less templated than correct orthography would.
//
// INVEST, never SPEND/GIVE - wherever copy quantifies time, frame it as an investment
// (invest / investir / invertir). Reason: "spend" frames the meeting as the reader's cost,
// "invest" frames it as their stake, which is the psychological point. Per Santiago 2026-08-25.
// Prefer the READER as the investor ("worth investing twenty minutes"); sender-side phrasing
// ("happy to invest 10 mins") is kept only where it already reads that way.

export const WORKING_FOLLOWUP = {
  en: {
    subject: 'Picking this back up?',
    body: name => `Hi ${name},

You had a slot booked with me a while back and the thread went quiet after that.

Still relevant on your side? Worth investing fifteen minutes to pick up where you left it.

${BOOK.en}

If it's off the table, just say so and I'll close it out.

Look forward to hearing soon`
  },
  fr: {
    subject: "Toujours d'actualité de votre côté?",
    body: name => `Bonjour ${name},

Nous avions bloqué un créneau ensemble, et le sujet est resté en suspens depuis.

C'est toujours d'actualité de votre côté? Cela vaut la peine d'y investir un quart d'heure pour reprendre là où nous nous étions arrêtés.

${BOOK.fr}

Si le projet est tombé à l'eau, dites-le-moi et je clôture le suivi de mon côté.

Au plaisir de vous lire`
  },
  es: {
    subject: 'Sigue en pie?',
    body: name => `Hola ${name},

Teníamos un hueco reservado y el tema se quedó ahí.

Sigue en pie por tu parte? Un cuarto de hora bien invertido y retomamos donde lo dejamos.

${BOOK.es}

Si ya está descartado, dímelo y lo cierro por mi parte.

Quedo atento`
  }
};

// Lukewarm copy for leads that replied to an email but never booked a meeting.
// UI-only: used by the in-app compose link. FR formal (vous), ES informal (tu).

export const LUKEWARM = {
  en: {
    subject: 'Worth twenty minutes?',
    body: name => `Hi ${name},

You wrote back at one point but we never got a call in the diary.

Worth investing twenty minutes? Enough to go through your setup and tell you straight whether CloudTalk fits.

${BOOK.en}

If it's not a priority right now, let me know and I'll stop chasing.

Look forward to hearing soon`
  },
  fr: {
    subject: 'Vingt minutes pour en parler?',
    body: name => `Bonjour ${name},

Vous m'aviez répondu il y a quelque temps, mais nous n'avons jamais réussi à caler un échange.

Ça vaut le coup d'y investir vingt minutes? De quoi passer votre configuration en revue et vous dire franchement si CloudTalk a sa place ou non.

${BOOK.fr}

Si ce n'est pas une priorité en ce moment, dites-le-moi et j'arrête de relancer.

Au plaisir de vous lire`
  },
  es: {
    subject: 'Merece la pena?',
    body: name => `Hola ${name},

Me contestaste en su momento, pero nunca llegamos a cuadrar una llamada.

Merece la pena invertir veinte minutos? Lo justo para repasar tu configuración y decirte con franqueza si CloudTalk encaja o no.

${BOOK.es}

Si ahora no es prioridad, dímelo y dejo de insistir.

Quedo atento`
  }
};

// Reactivation copy for the non-qual stale segment (no qual meeting held).
// UI-only: used by the in-app compose link, NOT by Plan 4 auto-drafts (Post-Qual only).
// FR formal (vous), ES informal (tu). Signed off by Santiago Subra 2026-07-06.

export const REACTIVATION = {
  en: {
    subject: 'Checking in on your setup - CloudTalk',
    body: name => `Hi ${name},

You came to CloudTalk a little while back but we haven't been able to connect since.

Are you still evaluating? Happy to invest 10 mins reviewing your use case.

${BOOK.en}

If the timing has shifted, no worries - just let me know and I'll leave it here.

Look forward to hearing soon`
  },
  fr: {
    subject: "Toujours d'actualité? - CloudTalk",
    body: name => `Bonjour ${name},

Vous aviez manifesté de l'intérêt pour CloudTalk il y a quelque temps, mais nous n'avons pas eu l'occasion d'échanger depuis.

Toujours en réflexion? J'investis volontiers dix minutes pour faire le point sur votre projet.

${BOOK.fr}

Si le sujet n'est plus d'actualité, dites-le-moi et j'en resterai là.

Au plaisir de vous lire`
  },
  es: {
    subject: 'Sigues valorando opciones? - CloudTalk',
    body: name => `Hola ${name},

Te interesaste por CloudTalk hace un tiempo, pero no hemos llegado a hablar desde entonces.

Sigues valorando opciones? Con gusto invierto diez minutos en repasar tu caso.

${BOOK.es}

Si ya no es el momento, dímelo sin más y lo dejo aquí.

Quedo atento`
  }
};
// __SHARED_COPY_END__
