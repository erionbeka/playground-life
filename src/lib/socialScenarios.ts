export type SocialFamily =
  | "emotion-interoception"
  | "assertiveness"
  | "family-shared-play"
  | "connection";

export interface SocialChoice {
  /** Strategy text shown on the button, e.g. "Wave and say hi". */
  text: string;
  /** Short label of the strategy, e.g. "friendly hello". */
  strategy: string;
  emoji?: string;
}

export interface SocialScenario {
  situation: string;
  choices: SocialChoice[];
  /** Gentle, autonomy-supportive debrief shown after exploring. */
  wonder: string;
}

export interface SocialPack {
  family: SocialFamily;
  intro: string;
  scenarios: SocialScenario[];
}

export const OWN_PLAN_CHOICE: SocialChoice = {
  text: "Make my own plan",
  strategy: "my own plan",
  emoji: "🗺️",
};

export const OWN_PLAN_WONDER =
  "Your own ideas are welcome. You can change your mind or ask a grown-up to help you plan.";

export const AUTO_OWN_PLAN_WONDERS = [
  "That works. You can change your mind anytime.",
  "Good to know. Next time you could try a different idea and see what feels right.",
  "Whatever feels right for you is OK. Grown-ups can help you choose too.",
];

const choice = (text: string, strategy: string, emoji: string): SocialChoice => ({ text, strategy, emoji });

const shake = (text: string): SocialChoice => choice(text, text.toLowerCase(), "🤝");
const say = (text: string, strategy: string): SocialChoice => choice(text, strategy, "🗣️");
const show = (text: string, strategy: string): SocialChoice => choice(text, strategy, "🫳");
const pause = (text: string, strategy: string): SocialChoice => choice(text, strategy, "⏸️");

export const SOCIAL_PACKS: Record<SocialFamily, SocialPack> = {
  "emotion-interoception": {
    family: "emotion-interoception",
    intro:
      "There's no single right answer here — let's explore what feelings feel like in your body and what helps.",
    scenarios: [
      {
        situation: "You notice a big feeling in your body — maybe fast heartbeat, warm cheeks, or butterflies.",
        choices: [
          choice("Name the feeling out loud", "naming the feeling", "🗂️"),
          choice("Slow breath in, slow breath out", "slow breathing", "🌬️"),
          choice("Pause and get a drink of water", "a water pause", "💧"),
          choice("Ask for a quiet break", "asking for a break", "🧘"),
        ],
        wonder: "You can pick more than one. Trying two strategies is a great way to learn what helps you.",
      },
      {
        situation: "You feel wiggly and it's hard to settle before a game.",
        choices: [
          choice("Squeeze and relax your hands", "a squeeze-and-let-go", "🤲"),
          choice("Count five slow breaths with a grown-up", "counting breaths", "🔢"),
          choice("Tell someone it's hard to settle today", "sharing how it feels", "💬"),
          choice("Do a small move, like stretching your arms", "a gentle stretch", "🌤️"),
        ],
        wonder: "The goal isn't to stop the wiggles fast — it's to find a way that feels OK for you.",
      },
      {
        situation: "A big feeling showed up while you were playing. You want some space to feel it.",
        choices: [
          choice("Say: I need a moment", "saying what you need", "🧑‍🦯"),
          choice("Ask for a break from the game", "asking for a break", "🧘"),
          choice("Squeeze a soft thing", "a soft squeeze", "🧸"),
          choice("Have a grown-up sit with you quietly", "company while you feel it", "👤"),
        ],
        wonder: "Feelings are information, not something to rush. It's OK to take the time you need.",
      },
    ],
  },
  assertiveness: {
    family: "assertiveness",
    intro:
      "Let's practice saying what you want and what feels OK — your body and your choices belong to you.",
    scenarios: [
      {
        situation: "A friend hugs you but you don't want a hug right now.",
        choices: [
          choice("Say: I don't want a hug, but a high-five works", "saying no kindly", "✋"),
          choice("Step back and shake your head", "stepping back", "🚶"),
          choice("Say: Please give me space", "asking for space", "🚪"),
          choice("Call a grown-up to help you say it", "getting support", "🧑‍🏫"),
        ],
        wonder: "You never have to hug to be friendly. You decide what contact feels OK for your body.",
      },
      {
        situation: "You need help with something and don't know how to ask.",
        choices: [
          choice("Say: Can you help me, please?", "asking for help", "🙋"),
          choice("Show what you're stuck on", "showing the stuck part", "📌"),
          choice("Write or draw a note to ask", "drawing it out", "✏️"),
          choice("Ask a grown-up to come with you", "getting a helper", "🧑‍🏫"),
        ],
        wonder: "Asking for help is a skill, not a weakness. You can practice it in your own way and time.",
      },
      {
        situation: "Someone keeps using your toy and didn't ask first.",
        choices: [
          choice("Say: My toy, please ask me", "setting a boundary", "🧱"),
          choice("Offer to take turns", "offering turns", "🔁"),
          choice("Say: I'm playing with this now", "naming your turn", "🎮"),
          choice("Ask an adult to help you both agree", "getting a referee", "🧑‍🏫"),
        ],
        wonder: "Setting boundaries protects your comfort. A friend who cares will respect a boundary.",
      },
    ],
  },
  "family-shared-play": {
    family: "family-shared-play",
    intro: "Let's explore ways to play together that feel good for everyone — including you.",
    scenarios: [
      {
        situation: "You want to join a game your friend is already playing.",
        choices: [
          choice("Watch and ask: Can I join?", "asking to join", "🙋"),
          choice("Find a spot in the game and ask what comes next", "joining the rhythm", "🎯"),
          choice("Ask what the rules are first", "learning the rules", "📜"),
          choice("Offer an idea for the game you'd like to try", "offering an idea", "💡"),
        ],
        wonder: "Joining play can be tricky. Every friend is different, and it's OK to try a few ways.",
      },
      {
        situation: "You and a friend both want to be the leader of the pretend game.",
        choices: [
          choice("Take turns being leader", "taking turns", "🔁"),
          choice("Make a team where you both lead", "co-leading", "🤝"),
          choice("Flip a coin to decide who starts", "coin flip", "🪙"),
          choice("Plan one game for each of you", "one game each", "🗓️"),
        ],
        wonder: "Sharing the lead can be more fun than winning it. Whatever you choose, both players' ideas count.",
      },
      {
        situation: "A friend did something that made the game less fun for you.",
        choices: [
          choice("Say: That didn't feel fun for me", "sharing your feelings", "🗣️"),
          choice("Ask: Can we try it a different way?", "proposing a change", "🔄"),
          choice("Take a short break from the game", "taking a break", "🧘"),
          choice("Talk to a grown-up about it", "talking it through", "🧑‍🏫"),
        ],
        wonder: "Solving friction together is part of shared play. Your feelings about the game matter.",
      },
    ],
  },
  connection: {
    family: "connection",
    intro: "There's no single right answer — let's explore friendly ways to connect with each other.",
    scenarios: [
      {
        situation: "You see someone you know and feel like saying hello.",
        choices: [
          choice("Wave and say hi", "a wave and a hi", "👋"),
          choice("Smile and nod", "a smile and nod", "😊"),
          choice("Say hi in your own way", "your own hello", "💬"),
          choice("Let them say hi first", "waiting your turn", "⏳"),
        ],
        wonder: "Greetings look different for everyone. What matters is connecting in a way that feels like you.",
      },
      {
        situation: "A friend looks like they're having a hard day.",
        choices: [
          choice("Sit nearby so they're not alone", "sitting nearby", "🪑"),
          choice("Ask: Are you OK? (No need to answer)", "asking gently", "❓"),
          choice("Offer to share a quiet activity", "a quiet activity together", "🧩"),
          choice("Tell a grown-up you're worried about them", "getting a grown-up", "🧑‍🏫"),
        ],
        wonder: "You don't need to fix a friend's day. Just being there can mean a lot.",
      },
      {
        situation: "A conversation is moving fast and you need more time to think.",
        choices: [
          choice("Say: Let me think for a moment", "asking for thinking time", "💭"),
          choice("Give a little nod and answer when ready", "answering in your time", "✅"),
          choice("Ask the other person to repeat it", "asking to repeat", "🔁"),
          choice("Say: I'd like to talk about this later", "rescheduling the chat", "📅"),
        ],
        wonder: "You get to set your own pace in a conversation. Friends can wait for you.",
      },
    ],
  },
};

/**
 * Theme-specific scenario pools. Each catalog social/emotion/language game theme
 * gets its own literal, on-theme scenarios so "Saying Sorry" actually teaches
 * apologizing and "Compliments" actually teaches giving compliments.
 */
export const THEME_SCENARIOS: Record<string, SocialScenario[]> = {
  greetings: [
    {
      situation: "You meet a new friend at the park and want to say hello.",
      choices: [
        choice("Wave and say hi", "a wave and a hi", "👋"),
        choice("Smile and nod at them", "a smile and a nod", "😊"),
        choice("Say: Hi, I'm [your name]", "introducing yourself", "🙋"),
        choice("Let them start the hello", "waiting for their hello", "⏳"),
      ],
      wonder: "There is no wrong way to say hello. Any hello that feels like yours counts.",
    },
    {
      situation: "You walk past someone you know, but you're not sure what to do.",
      choices: [
        choice("Give a little wave", "a small wave", "👋"),
        choice("Say hello while passing", "a passing hello", "🗣️"),
        choice("Smile as you go by", "a passing smile", "😊"),
        choice("Say nothing this time and that is fine", "busy passing by", "🚶"),
      ],
      wonder: "Greetings are optional and they grow with practice. You decide what fits each moment.",
    },
  ],
  sharing: [
    {
      situation: "You are playing with a car and a friend asks for a turn.",
      choices: [
        choice("Say: You can have it after my turn", "a turn plan", "🔁"),
        choice("Offer a different toy to share", "sharing another toy", "🧸"),
        choice("Ask a grown-up to help you take turns", "turn help", "🧑‍🏫"),
        choice("Say: Not right now, but maybe later", "a gentle no", "🚫"),
      ],
      wonder: "Sharing has many shapes — taking turns, swapping, or choosing your own timing all count.",
    },
    {
      situation: "There is one cookie left and you both want it.",
      choices: [
        choice("Split it in half", "splitting it", "🔪"),
        choice("Offer: You take it today", "letting them have it", "🤲"),
        choice("Flip a coin to choose", "a coin flip", "🪙"),
        choice("Ask a grown-up to decide together", "a grown-up helps", "🧑‍🏫"),
      ],
      wonder: "When there's one of something, a fair plan is more fun than grabbing.",
    },
    {
      situation: "A friend shares their snack with you. You want to show it matters.",
      choices: [
        choice("Say: Thank you for sharing", "saying thank you", "😊"),
        choice("Smile and nod", "a warm nod", "✅"),
        choice("Offer them something of yours later", "returning the kindness", "🔄"),
        choice("Say: That was nice", "naming the kindness", "💬"),
      ],
      wonder: "A simple thank-you tells your friend their sharing was noticed and appreciated.",
    },
  ],
  "asking for help": [
    {
      situation: "Your puzzle piece won't fit and you feel stuck.",
      choices: [
        choice("Say: Can you help me, please?", "asking for help", "🙋"),
        choice("Point to the piece that won't fit", "pointing it out", "👉"),
        choice("Show what you've tried", "showing your attempt", "🫳"),
        choice("Ask a grown-up to sit with you", "getting company", "🧑‍🏫"),
      ],
      wonder: "Asking for help is a skill you can practice. The sooner you ask, the sooner you can play.",
    },
    {
      situation: "Your shoes are tricky to tie and you're getting frustrated.",
      choices: [
        choice("Ask: Can you show me how?", "asking to be shown", "👟"),
        choice("Ask for a break first", "a quick break", "⏸️"),
        choice("Ask for help, then try one step myself", "help plus practice", "🔄"),
        choice("Bring the shoe to a grown-up", "bringing the shoe", "🫳"),
      ],
      wonder: "Strong helpers ask for what they need. Taking a break is part of the plan.",
    },
    {
      situation: "You're lost in a big store and need a grown-up.",
      choices: [
        choice("Find a helper who works there", "finding a helper", "🧑‍✈️"),
        choice("Say: I need help finding my grown-up", "saying what you need", "🗣️"),
        choice("Stay where you are and call for your grown-up", "staying put", "📍"),
        choice("Ask someone to call your grown-up", "asking for a call", "📞"),
      ],
      wonder: "Asking a trusted helper for help keeps you safe. That is smart and brave.",
    },
  ],
  "taking turns": [
    {
      situation: "You and a friend are at the slide and you both want to go first.",
      choices: [
        choice("Let them slide first", "letting them go", "🎠"),
        choice("Go first, then they go — one after the other", "turn-taking", "🔁"),
        choice("Ask a grown-up to count turns", "a turn counter", "🧑‍🏫"),
        choice("Ask what order feels best", "asking together", "💬"),
      ],
      wonder: "Turns work for everyone when the order is fair and clear.",
    },
    {
      situation: "You're playing a game where you each get to pick a song.",
      choices: [
        choice("You pick one, then they pick one", "one song each", "🎵"),
        choice("Let them pick first today", "their pick first", "🎶"),
        choice("Make a pair play-list together", "a shared playlist", "🎧"),
        choice("Ask who wants to choose first", "choosing together", "🙋"),
      ],
      wonder: "Taking turns with choices means both friends get a turn with what they love.",
    },
    {
      situation: "It's hard to wait for your turn with the game controller.",
      choices: [
        choice("Watch their turn and cheer", "watching your friend", "👀"),
        choice("Plan what you'll do on your turn", "planning your turn", "🗓️"),
        choice("Ask to set a timer for turns", "a turn timer", "⏱️"),
        choice("Say: My turn will come", "a kind reminder", "💬"),
      ],
      wonder: "Waiting is easier when you know your turn is coming. Your turn will happen.",
    },
  ],
  "saying please": [
    {
      situation: "You want someone to pass you the crayons.",
      choices: [
        choice("Say: May I have the crayons, please?", "asking with please", "🖍️"),
        choice("Point at the crayons and say please", "point and please", "👉"),
        choice("Hold out your hand and ask kindly", "an open hand ask", "🤲"),
        choice("Ask after their turn if now is busy", "timing your ask", "⏳"),
      ],
      wonder: "Please is a small word that makes requests feel kind. Any polite ask works.",
    },
    {
      situation: "You want a turn with a toy a friend is holding.",
      choices: [
        choice("Say: Please may I have a turn?", "please for a turn", "🙋"),
        choice("Ask: Can we take turns, please?", "turns with please", "🔁"),
        choice("Wait and ask again a little later", "waiting to ask", "⏳"),
        choice("Ask a grown-up to help you ask", "help with the ask", "🧑‍🏫"),
      ],
      wonder: "Asking with please shows respect. Waiting for a good moment is part of the ask.",
    },
  ],
  "saying sorry": [
    {
      situation: "You accidentally knocked over a friend's block tower.",
      choices: [
        choice("Say: I'm sorry I knocked it over", "a sincere sorry", "🗣️"),
        choice("Offer to help rebuild it together", "helping rebuild", "🧱"),
        choice("Say: I didn't mean to. Can we build again?", "explaining and offering", "🤝"),
        choice("Ask: How can I help make it better?", "asking to make amends", "🤲"),
      ],
      wonder: "A sincere sorry plus a kind action shows you care about your friend's feelings.",
    },
    {
      situation: "You said something that hurt a friend's feelings.",
      choices: [
        choice("Say: I'm sorry. That hurt you", "naming the hurt", "💔"),
        choice("Ask: Is there a way we can fix this?", "asking to fix it", "🤝"),
        choice("Give them space and say sorry later", "space then sorry", "⏳"),
        choice("Tell a grown-up so they can help", "getting help to mend it", "🧑‍🏫"),
      ],
      wonder: "Apologizing is about the other person's feelings. A real sorry opens the door to repair.",
    },
    {
      situation: "You grabbed a friend's toy without asking.",
      choices: [
        choice("Say: I'm sorry I grabbed it. Here you go", "returning and apologizing", "🔁"),
        choice("Hand it back and ask: Can I have a turn?", "returning and asking", "🙋"),
        choice("Say: That wasn't okay. I'll ask next time", "naming the boundary", "🗣️"),
        choice("Ask the friend how they'd like to solve it", "asking them", "🤲"),
      ],
      wonder: "Admitting a mistake is a sign of strength. It builds trust with your friend.",
    },
  ],
  compliments: [
    {
      situation: "Your friend built a really tall tower.",
      choices: [
        choice("Say: Your tower is amazing!", "praising the build", "🏰"),
        choice("Say: I like the tall part you made", "naming what you like", "👍"),
        choice("Clap for their tower", "a happy clap", "👏"),
        choice("Say: You worked hard on that", "noticing the effort", "💪"),
      ],
      wonder: "Compliments notice the good things people do. Yours can make a friend's day shine.",
    },
    {
      situation: "Your friend shared their snack with you.",
      choices: [
        choice("Say: That was so kind", "thanking with notice", "😊"),
        choice("Say: Thank you for sharing", "a warm thank you", "🙏"),
        choice("Say: You're a good friend", "naming friendship", "🤝"),
        choice("Return the kindness later", "kindness back", "🔄"),
      ],
      wonder: "Noticing kindness with a compliment strengthens your friendship.",
    },
    {
      situation: "Your friend did something brave, like trying a new climb.",
      choices: [
        choice("Say: You did it!", "cheering the win", "🎉"),
        choice("Say: You were brave to try", "naming bravery", "🦁"),
        choice("Say: I saw you try really hard", "noticing effort", "💪"),
        choice("Give a big smile and thumbs up", "a thumbs up", "👍"),
      ],
      wonder: "Compliments about courage and effort help friends feel seen and proud.",
    },
  ],
  listening: [
    {
      situation: "A friend is telling you about their day at school.",
      choices: [
        choice("Look toward them and give a nod", "nodding along", "👍"),
        choice("Wait until they finish before I talk", "waiting my turn", "⏳"),
        choice("Ask a question about what they said", "asking a question", "❓"),
        choice("Say: Tell me more", "inviting more", "🗣️"),
      ],
      wonder: "Listening means giving someone your attention. A nod tells them you're right here.",
    },
    {
      situation: "It's noisy and you're trying to hear what someone is saying.",
      choices: [
        choice("Move closer and listen", "moving closer", "🦻"),
        choice("Ask: Can you say that again, please?", "asking to repeat", "🔁"),
        choice("Move to a quieter spot", "finding quiet", "🔇"),
        choice("Say: The noise makes it hard to hear", "naming the noise", "🗣️"),
      ],
      wonder: "Asking someone to repeat themselves is a good listener move, not a mistake.",
    },
    {
      situation: "Someone gives you three things to remember (a game, then snack, then music).",
      choices: [
        choice("Repeat them back to be sure", "checking I heard", "🔁"),
        choice("Watch and wait for the first one", "starting the list", "1️⃣"),
        choice("Ask them to repeat one part", "asking for one again", "❓"),
        choice("Write or draw the list", "writing it down", "✏️"),
      ],
      wonder: "Repeating or writing things down helps your memory hold them. Great listening toolkit.",
    },
  ],
  "eye contact": [
    {
      situation: "You are talking with a friend and wondering where to look.",
      choices: [
        choice("Look at their face, or their direction", "looking their way", "👀"),
        choice("Listen and look when ready", "looking when ready", "🕊️"),
        choice("Focus on their voice instead", "listening to their voice", "👂"),
        choice("You choose how comfortable feels", "your comfortable way", "💭"),
      ],
      wonder: "You never have to force eye contact. What matters is that you are engaged and comfortable.",
    },
    {
      situation: "Someone is smiling at you from across the room.",
      choices: [
        choice("Smile back", "a smile back", "😊"),
        choice("Give a small wave", "a little wave", "👋"),
        choice("Nod hello", "a nod", "👍"),
        choice("Wait and see what feels right", "taking your time", "⏳"),
      ],
      wonder: "Friendly hello signals can be small. Your comfortable version is perfect.",
    },
  ],
  "personal space": [
    {
      situation: "A friend is standing very close to you and it feels too close.",
      choices: [
        choice("Step back a little", "stepping back", "🚶"),
        choice("Say: Can you give me a little space?", "asking for space", "🚪"),
        choice("Say: I like standing further apart", "your space zone", "🤲"),
        choice("Call a grown-up to help you say it", "getting help", "🧑‍🏫"),
      ],
      wonder: "Everyone has a space bubble that feels right for them. You get to choose yours.",
    },
    {
      situation: "A friend wants to hold your hand but you're not ready.",
      choices: [
        choice("Say: Not right now", "a gentle no", "🚫"),
        choice("Offer a high-five instead", "a high-five", "✋"),
        choice("Say: I'd rather walk beside you", "walking side by side", "👣"),
        choice("Ask for a wave instead", "a wave", "👋"),
      ],
      wonder: "Contact is always your choice. A high-five is still friendly and still says you care.",
    },
  ],
  "joining play": [
    {
      situation: "Two friends are playing a game you'd love to join.",
      choices: [
        choice("Watch and ask: Can I join?", "asking to join", "🙋"),
        choice("Ask: What are you playing?", "learning the game", "🎮"),
        choice("Say: That looks fun. Can I have a turn?", "asking for a turn", "🎯"),
        choice("Offer an idea that adds to the game", "adding an idea", "💡"),
      ],
      wonder: "Most players welcome a friendly ask to join. Your idea can make the game bigger.",
    },
    {
      situation: "You're playing alone and would like company.",
      choices: [
        choice("Ask: Does anyone want to play with me?", "inviting players", "🙋"),
        choice("Ask a friend to play a game you both like", "picking a shared game", "🎲"),
        choice("Set your game out where friends can see", "setting it up", "🪧"),
        choice("Ask a grown-up to help you invite a friend", "helping to invite", "🧑‍🏫"),
      ],
      wonder: "Inviting others is a skill. Doing it your way is exactly right.",
    },
  ],
  "expressing feelings": [
    {
      situation: "You feel angry and want someone to know.",
      choices: [
        choice("Say: I am feeling angry right now", "naming the feeling", "😠"),
        choice("Say: I need a moment to cool down", "asking for space", "⏸️"),
        choice("Show a feeling card or face", "showing the feeling", "🃏"),
        choice("Tell a grown-up about it", "telling a grown-up", "🧑‍🏫"),
      ],
      wonder: "Naming a big feeling is powerful. All feelings are allowed — what matters is what you decide next.",
    },
    {
      situation: "Something surprising happened and you feel excited.",
      choices: [
        choice("Say: Wow, I'm so excited!", "sharing excitement", "😲"),
        choice("Jump or wiggle to let it out", "letting it out", "🎉"),
        choice("Tell someone about the surprise", "telling the story", "🗣️"),
        choice("Ask a friend to celebrate with you", "celebrating together", "🎊"),
      ],
      wonder: "Sharing happy feelings doubles the joy. Your big feelings are welcome here.",
    },
    {
      situation: "You feel sad and it's hard to find words.",
      choices: [
        choice("Say: I feel sad", "naming sadness", "😢"),
        choice("Ask for a hug or some quiet", "asking for comfort", "🫂"),
        choice("Draw or point to how you feel", "drawing the feeling", "✏️"),
        choice("Have a grown-up sit with you", "company while sad", "🪑"),
      ],
      wonder: "Sad feelings get easier when you share them. There is no timer on feeling better.",
    },
  ],
  "waiting patiently": [
    {
      situation: "You are waiting for your turn and it feels like forever.",
      choices: [
        choice("Watch the game and plan your turn", "planning my turn", "🗓️"),
        choice("Count to ten slowly", "counting calmly", "🔢"),
        choice("Ask a friend to chat while we wait", "a waiting chat", "💬"),
        choice("Ask for a grown-up to help you wait", "waiting support", "🧑‍🏫"),
      ],
      wonder: "Waiting is a skill like any other. A calm plan makes waiting easier.",
    },
    {
      situation: "You are waiting in line at the water fountain.",
      choices: [
        choice("Stand in line and count the people ahead", "counting ahead", "1️⃣"),
        choice("Take slow breaths while you wait", "slow breaths", "🌬️"),
        choice("Notice what's around you quietly", "quiet looking", "👀"),
        choice("Ask a friend to take turns with you", "turn plan", "🔁"),
      ],
      wonder: "Especially in a line, the best plan is a calm one. Your turn always comes.",
    },
  ],
  "reading body language": [
    {
      situation: "A friend is smiling and their arms are open wide.",
      choices: [
        choice("Think: they might feel happy to see me", "reading happy", "😊"),
        choice("Smile and wave back", "responding warmly", "👋"),
        choice("Say: You look happy today", "naming their mood", "🗣️"),
        choice("Wait and let them speak first", "waiting", "⏳"),
      ],
      wonder: "Body signals offer clues, not rules. Smiles usually say: I am friendly right now.",
    },
    {
      situation: "A friend has their arms crossed and is looking down.",
      choices: [
        choice("Think: they might need some quiet", "reading quiet", "🤫"),
        choice("Say: Are you okay? No need to answer", "asking gently", "❓"),
        choice("Give them space for now", "giving space", "🚶"),
        choice("Tell a grown-up about them", "telling a grown-up", "🧑‍🏫"),
      ],
      wonder: "Body signs are guesses, not facts. Being gentle and curious always fits.",
    },
    {
      situation: "A friend is bouncing on their chair and looking at the door.",
      choices: [
        choice("Think: they might be ready to move", "reading wiggles", "🪑"),
        choice("Ask: Do you want to go outside?", "guessing kindly", "🌳"),
        choice("Offer a break or a stretch", "offering a break", "🧘"),
        choice("Ask: What do you feel like doing?", "asking them", "❓"),
      ],
      wonder: "When bodies look restless, a friendly question beats a guess.",
    },
  ],
  "cooperative problem solving": [
    {
      situation: "Two friends want to play different games at the same time.",
      choices: [
        choice("Play one game, then the other", "both games in order", "🗓️"),
        choice("Make a new game from both ideas", "mixing ideas", "🎲"),
        choice("Each pick one half of the plan", "splitting the plan", "🤝"),
        choice("Ask a grown-up to help you decide", "getting a referee", "🧑‍🏫"),
      ],
      wonder: "Working together means everyone's idea can live. A fair plan is the win.",
    },
    {
      situation: "The puzzle is hard together and nobody knows the next piece.",
      choices: [
        choice("Look together for edge pieces", "searching together", "🔍"),
        choice("Take turns trying pieces", "trying in turns", "🔁"),
        choice("Ask: Do you want a hint from me?", "offering a hint", "💡"),
        choice("Ask a grown-up for one tip", "one external tip", "🧑‍🏫"),
      ],
      wonder: "Two brains are better than one. Solving together bonds you as teammates.",
    },
  ],
  "happy face": [
    {
      situation: "Your friend draws a picture and is very proud.",
      choices: [
        choice("Say: That's wonderful!", "sharing happiness", "🎨"),
        choice("Smile and nod", "a happy nod", "😊"),
        choice("Say: I can tell you worked hard", "noticing effort", "💪"),
        choice("Clap for their art", "a happy clap", "👏"),
      ],
      wonder: "Happy faces often show what matters to people. Sharing their joy is a gift.",
    },
  ],
  "sad face": [
    {
      situation: "Your friend's balloon floated away and they look sad.",
      choices: [
        choice("Say: I'm sorry your balloon is gone", "naming their feeling", "🎈"),
        choice("Sit with them quietly", "sitting together", "🪑"),
        choice("Offer your spare balloon or toy", "offering comfort", "🎁"),
        choice("Ask: Do you want a hug or space?", "asking what helps", "🫂"),
      ],
      wonder: "Sad friends usually want company more than fixes. Asking beats assuming.",
    },
  ],
  "angry face": [
    {
      situation: "Your friend looks angry after losing a game.",
      choices: [
        choice("Give them space to feel it", "giving space", "🚶"),
        choice("Say: That felt disappointing", "naming the feeling", "😤"),
        choice("Offer: Want to play again?", "offering a rematch", "🎮"),
        choice("Ask a grown-up to help later", "getting help", "🧑‍🏫"),
      ],
      wonder: "Anger is a signal, not a problem. Respecting the signal builds trust.",
    },
  ],
  "scared face": [
    {
      situation: "A loud noise scared your friend.",
      choices: [
        choice("Say: That noise was loud", "naming the noise", "💥"),
        choice("Ask: Do you want some quiet?", "offering quiet", "🔇"),
        choice("Stay near them", "staying nearby", "🪑"),
        choice("Tell a grown-up if they seem upset", "getting help", "🧑‍🏫"),
      ],
      wonder: "Being near a scared friend often helps more than words.",
    },
  ],
  "surprised face": [
    {
      situation: "Your friend got a surprise gift and looks surprised.",
      choices: [
        choice("Say: Wow, what a surprise!", "sharing the surprise", "🎁"),
        choice("Smile and say: That's exciting", "sharing excitement", "🤩"),
        choice("Ask: What do you think of it?", "asking their thoughts", "❓"),
        choice("Let them enjoy the moment", "letting them enjoy it", "🥳"),
      ],
      wonder: "Surprise can feel big. Sharing the moment together makes it special.",
    },
  ],
  "calm breathing": [
    {
      situation: "You notice your body feels tight and your breath is fast.",
      choices: [
        choice("Take one slow breath in and out", "one slow breath", "🌬️"),
        choice("Breathe in for a slow count of four", "counting to four", "4️⃣"),
        choice("Breathe out longer than you breathe in", "long outbreath", "➡️"),
        choice("Ask a grown-up to breathe with you", "breathing together", "🧑‍🏫"),
      ],
      wonder: "Slow breathing tells your body it can settle. Any rhythm that helps you counts.",
    },
  ],
  "feeling thermometer": [
    {
      situation: "You're talking about how big your feeling is today.",
      choices: [
        choice("Say: It's a high number today", "a high reading", "🌡️"),
        choice("Show a calm, medium, or big face", "showing the level", "🃏"),
        choice("Say: It's a small feeling today", "a small reading", "📉"),
        choice("Draw your thermometer and mark it", "drawing it", "✏️"),
      ],
      wonder: "Feelings have size, and every size is real. Naming the size helps you choose what you need.",
    },
  ],
  "emotion charades": [
    {
      situation: "It's your turn to act out a feeling without words.",
      choices: [
        choice("Make a happy face and jump", "acting happy", "😊"),
        choice("Make a surprised face with wide eyes", "acting surprised", "😲"),
        choice("Slump your shoulders for sad", "acting sad", "😢"),
        choice("Squeeze your hands for angry", "acting angry", "😠"),
      ],
      wonder: "Bodies show feelings in many ways. Your charade can be small or big — both are right.",
    },
  ],
  "mood match": [
    {
      situation: "You see a face with a smile and wide-open eyes.",
      choices: [
        choice("Match it with a happy face", "matching happy", "😊"),
        choice("Match it with a surprised face", "matching surprised", "😲"),
        choice("Say: I think this is excited", "naming excited", "🤩"),
        choice("Ask a friend what they see", "checking together", "🤝"),
      ],
      wonder: "Face matching is a guess made in kindness. There's room for many readings.",
    },
  ],
  "feeling stories": [
    {
      situation: "You're making up a story about a little cloud that feels worried.",
      choices: [
        choice("Say: The cloud is worried about rain", "naming the worry", "☁️"),
        choice("Give the cloud a friend", "adding a friend", "🤝"),
        choice("Say: The cloud finds a calm place", "a calm place", "🌤️"),
        choice("Make up your own ending", "your own ending", "✨"),
      ],
      wonder: "Feelings in stories are safe to explore. Your story ends how you want.",
    },
  ],
  "emotion detective": [
    {
      situation: "You are on a feelings case: what clues can you find?",
      choices: [
        choice("Look for smiles or frowns", "face clues", "🔎"),
        choice("Listen to the voice tone", "voice clues", "👂"),
        choice("Notice calm, fast, or slow bodies", "body clues", "🕵️"),
        choice("Ask what the person feels", "asking directly", "❓"),
      ],
      wonder: "Good detectives gather clues and ask. Questions are the best clue of all.",
    },
  ],
  "calm down corner": [
    {
      situation: "Your body is loud inside and you want a calm spot.",
      choices: [
        choice("Ask to go to the calm spot", "asking for it", "🧘"),
        choice("Take a quiet breath first", "a settling breath", "🌬️"),
        choice("Bring a soft toy with you", "bringing comfort", "🧸"),
        choice("Say: I need a minute in the corner", "naming the need", "🗣️"),
      ],
      wonder: "Choosing your calm spot is self-care, not giving up. You set the pace.",
    },
  ],
  "first words": [
    {
      situation: "You want your favorite drink and want a word for it.",
      choices: [
        choice("Say: More", "the word more", "➕"),
        choice("Say: Drink", "the word drink", "🥤"),
        choice("Point and say the beginning sound", "a sound start", "👄"),
        choice("Use a sign or a card instead", "a sign or card", "🃏"),
      ],
      wonder: "Every first word is a win. Words, signs, and cards all count as talking.",
    },
  ],
  "action words": [
    {
      situation: "You're guessing what a friend is doing (they're pretending).",
      choices: [
        choice("Say: Run!", "naming run", "🏃"),
        choice("Say: Jump!", "naming jump", "🤸"),
        choice("Say: Sleep!", "naming sleep", "😴"),
        choice("Say: Eat!", "naming eat", "🍽️"),
      ],
      wonder: "Action words name what bodies do. Any good guess is a great try.",
    },
  ],
  "describing words": [
    {
      situation: "You're describing a big, soft, blue blanket.",
      choices: [
        choice("Say: It is soft", "soft", "☁️"),
        choice("Say: It is big", "big", "🐘"),
        choice("Say: It is blue", "blue", "🔵"),
        choice("Say: It is cozy", "cozy", "🛋️"),
      ],
      wonder: "Describing words paint pictures with sound. Your words can make others see it.",
    },
  ],
  "question starters": [
    {
      situation: "You want to know your friend's favorite animal.",
      choices: [
        choice("Ask: What is your favorite animal?", "a what question", "❓"),
        choice("Ask: Do you like dogs?", "a yes/no question", "🐶"),
        choice("Ask: What do you like about animals?", "an open question", "🦁"),
        choice("Draw your favorite and let them share", "drawing a question", "✏️"),
      ],
      wonder: "Questions open doors to new worlds. There are many ways to ask.",
    },
  ],
  "story starters": [
    {
      situation: "You're starting a story about a sleepy dragon.",
      choices: [
        choice("Say: Once upon a time, there was a dragon", "the opening", "🐉"),
        choice("Say: The dragon woke up slowly", "a sleepy start", "😴"),
        choice("Start with the dragon's home", "the setting", "🏰"),
        choice("Start your own way", "your own start", "✨"),
      ],
      wonder: "Every story needs a start, and you get to choose how it begins.",
    },
  ],
  "rhyming fun": [
    {
      situation: "You're playing a rhyme game and need a word that makes a pair.",
      choices: [
        choice("Cat … say: Hat", "cat and hat", "🎩"),
        choice("Dog … say: Log", "dog and log", "🪵"),
        choice("Sun … say: Fun", "sun and fun", "☀️"),
        choice("Make up your own rhyme", "your own rhyme", "✨"),
      ],
      wonder: "Rhymes are sound puzzles. Your own pairs are welcome treasures.",
    },
  ],
  "sentence builder": [
    {
      situation: "You're building a sentence about playing at the park.",
      choices: [
        choice("Say: I play", "the start", "🏞️"),
        choice("Say: I play on the slide", "adding a place", "🛝"),
        choice("Say: I play with my friend", "adding a person", "🧑‍🤝‍🧑"),
        choice("Build a sentence your own way", "your own sentence", "✨"),
      ],
      wonder: "Sentences grow one brick at a time. Any sentence you build is yours.",
    },
  ],
  "what comes next": [
    {
      situation: "You're naming what comes next in a story or routine.",
      choices: [
        choice("After breakfast comes lunch", "the next meal", "🍽️"),
        choice("After playing comes tidying", "the next action", "🧹"),
        choice("After day comes night", "the next time", "🌙"),
        choice("Your own next step", "your own next", "✨"),
      ],
      wonder: "Predicting what's next helps routines feel safe and predictable.",
    },
  ],
  "picture naming": [
    {
      situation: "You see a picture and want to name it.",
      choices: [
        choice("Say: Dog", "naming dog", "🐶"),
        choice("Say: Apple", "naming apple", "🍎"),
        choice("Say: Car", "naming car", "🚗"),
        choice("Name your own picture", "your own picture", "🖼️"),
      ],
      wonder: "Naming pictures builds your word world. Every name you try grows your voice.",
    },
  ],
  "category names": [
    {
      situation: "You're grouping things that fly together.",
      choices: [
        choice("Say: Birds fly", "birds", "🐦"),
        choice("Say: Planes fly", "planes", "✈️"),
        choice("Say: Butterflies fly", "butterflies", "🦋"),
        choice("Add your own flying thing", "your own pick", "✨"),
      ],
      wonder: "Categories group the world into helpful boxes. Your box rules are welcome.",
    },
  ],
  "following directions": [
    {
      situation: "You're following a three-part direction: clap, turn, sit.",
      choices: [
        choice("Clap, then turn, then sit", "doing it in order", "1️⃣"),
        choice("Ask to hear it again", "asking to repeat", "🔁"),
        choice("Do one step at a time", "one step at a time", "🧗"),
        choice("Follow in your own comfortable order", "your own order", "✨"),
      ],
      wonder: "Following directions is easier step by step. Asking for a repeat is smart.",
    },
  ],
  "conversation starter": [
    {
      situation: "You want to start a chat with a new friend.",
      choices: [
        choice("Ask: What games do you like?", "a game question", "🎮"),
        choice("Say: My name is [your name]", "introducing", "🙋"),
        choice("Ask: Do you want to draw with me?", "an invitation to draw", "🎨"),
        choice("Wait and let them start", "letting them start", "⏳"),
      ],
      wonder: "Starting a chat is brave. A friendly question or hello opens the door.",
    },
  ],
  "waiting for turn": [
    {
      situation: "You're waiting for a turn with a favorite toy.",
      choices: [
        choice("Plan what I'll do with my turn", "planning my turn", "🗓️"),
        choice("Watch my friend and cheer them", "watching their turn", "👀"),
        choice("Count five slow breaths", "five slow breaths", "🌬️"),
        choice("Ask a grown-up to help me wait", "waiting support", "🧑‍🏫"),
      ],
      wonder: "Waiting is hard work, and you're doing it. Your turn is on its way.",
    },
  ],
  "sharing toys": [
    {
      situation: "A friend would like to try the toy you're holding.",
      choices: [
        choice("Say: Let's take turns", "offering turns", "🔁"),
        choice("Share the toy together at the same time", "sharing together", "🤝"),
        choice("Say: You can have it in a minute", "a minute plan", "⏱️"),
        choice("Choose your own sharing plan", "your own plan", "✨"),
      ],
      wonder: "Sharing is a choice, and you're the one who gets to decide how it looks.",
    },
  ],
  "connecting with friends": [
    {
      situation: "You see a friend today and want a gentle hello.",
      choices: [
        choice("Wave and say hi", "a wave and hi", "👋"),
        choice("Smile and nod", "a smile and nod", "😊"),
        choice("Say hello with a word you like", "a word you like", "💬"),
        choice("Let them start today", "letting them start", "⏳"),
      ],
      wonder: "Connecting can be quiet or loud, big or small. Your comfortable way is the right way.",
    },
  ],
};

export function familyForTheme(theme: string): SocialFamily {
  const t = theme.toLowerCase();
  if (/(eye|contact|gaze|greet|hello|friend|compliment|praise)/.test(t)) return "connection";
  if (/(feel|emotion|calm|breath|mood|charade|thermometer|detective|face|sad|happy|angry|scared|surprised|worry)/.test(t)) {
    return "emotion-interoception";
  }
  if (/(space|hug|no\b|boundary|autonomy|please|asking|ask\b|help|speak|say\b|express|feeling)/.test(t)) {
    return "assertiveness";
  }
  return "family-shared-play";
}

export function familyLabel(family: SocialFamily): string {
  switch (family) {
    case "emotion-interoception":
      return "Feelings & Body Signals";
    case "assertiveness":
      return "My Voice, My Body, My Choices";
    case "family-shared-play":
      return "Playing Together";
    case "connection":
      return "Connecting With Friends";
  }
}

function normalizeTheme(theme: string): string {
  return theme.trim().toLowerCase().replace(/[-_]/g, " ");
}

export function scenariosForTheme(theme: string, limit = 3): { pack: SocialPack; scenarios: SocialScenario[] } {
  const normalized = normalizeTheme(theme);
  const family = familyForTheme(normalized);
  const pack = SOCIAL_PACKS[family];
  const themed = THEME_SCENARIOS[normalized];

  if (themed && themed.length) {
    return { pack, scenarios: themed.slice(0, Math.max(1, limit)) };
  }

  return { pack, scenarios: pack.scenarios.slice(0, Math.max(1, limit)) };
}