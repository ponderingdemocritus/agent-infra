/**
 * Character Generator
 *
 * Generates characters with randomized traits and diverse, interesting speech examples
 */

interface Character {
  id: string;
  name: string;
  traits: {
    aggression: number; // Tendency toward confrontation vs peaceful resolution
    agreeability: number; // How easily they get along with others
    openness: number; // Curiosity and openness to new experiences
    conscientiousness: number; // Organization and reliability
    extraversion: number; // Sociability and energy in social situations
    neuroticism: number; // Emotional stability vs anxiety/moodiness
    empathy: number; // Ability to understand others' feelings
    confidence: number; // Self-assurance and belief in own abilities
    adaptability: number; // Flexibility in changing situations
    impulsivity: number; // Acting on whims vs careful consideration
    evil: number; // Moral alignment toward malevolence and selfishness
    good: number; // Moral alignment toward benevolence and altruism
    chivalry: number; // Adherence to a code of honor and courtesy
    vagabond: number; // Tendency toward a wandering, rootless lifestyle
  };
  motivation: {
    primary: string; // Main goal or objective
    description: string; // Detailed explanation of motivation
    intensity: number; // How strongly they pursue this goal (1-10)
  };
  communicationStyle: {
    preferredTone: string; // How they typically express themselves (sarcastic, optimistic, etc.)
    commonExpressions: string[]; // Signature phrases or expressions they often use
    humorType: string; // Their typical style of humor
  };
  speechExamples: string[];
}

function getRandomInt(min: number, max: number, seed: number): number {
  const hash = (seed * 9301 + 49297) % 233280;
  return (hash % (max - min + 1)) + min;
}

function generateTraitValue(seed: number): number {
  return (seed % 10) + 1;
}

function generateId(seed: number): string {
  // Use seed to generate deterministic id
  const hash1 = (seed * 9301 + 49297) % 233280;
  const hash2 = (hash1 * 9301 + 49297) % 233280;
  const hash3 = (hash2 * 9301 + 49297) % 233280;
  const hash4 = (hash3 * 9301 + 49297) % 233280;

  const part1 = hash1.toString(36).substring(0, 5);
  const part2 = hash2.toString(36).substring(0, 5);
  const part3 = hash3.toString(36).substring(0, 5);
  const part4 = hash4.toString(36).substring(0, 5);

  // Combine parts with separators to create a longer ID
  return `${part1}-${part2}-${part3}-${part4}`;
}

function generateSpeechExamples(
  seed: number,
  traits: Character["traits"],
  motivation?: Character["motivation"]
): string[] {
  const examples: string[] = [];

  // High aggression
  if (traits.aggression > 8) {
    const phrases = [
      "Let's just fight our way through this!",
      "I'm not afraid to get my hands dirty if someone gets in my way.",
      "Violence is often the quickest solution to a problem.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Low aggression
  if (traits.aggression < 3) {
    const phrases = [
      "I'd rather find a peaceful solution if possible.",
      "Violence should always be the last resort.",
      "Let's talk this through before doing anything rash.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High agreeability
  if (traits.agreeability > 8) {
    const phrases = [
      "I'm sure we can all find common ground here.",
      "I see your point, and I think you're right.",
      "Let's work together to find a solution everyone's happy with.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Low agreeability
  if (traits.agreeability < 3) {
    const phrases = [
      "I don't care what anyone else thinks, I'm doing it my way.",
      "Your plan is flawed. Here's what we should do instead.",
      "*scoffs* That's the stupidest idea I've heard all day.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High openness
  if (traits.openness > 8) {
    const phrases = [
      "Let's try something completely different this time!",
      "I'm always eager to explore new possibilities.",
      "What an interesting idea! I'd love to see where it leads.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High conscientiousness
  if (traits.conscientiousness > 8) {
    const phrases = [
      "Let me double-check everything before we proceed.",
      "I've prepared a detailed plan with contingencies for every scenario.",
      "Attention to detail is crucial for success.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High extraversion
  if (traits.extraversion > 8) {
    const phrases = [
      "Let's gather everyone together and discuss this!",
      "I thrive in these group situations.",
      "*enthusiastically* This is going to be amazing!",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Low extraversion
  if (traits.extraversion < 3) {
    const phrases = [
      "I'd prefer to work alone, if that's alright.",
      "*quietly* I'll just observe for now.",
      "All this social interaction is exhausting.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High neuroticism
  if (traits.neuroticism > 8) {
    const phrases = [
      "What if everything goes wrong? Have we thought about that?",
      "*anxiously* I'm not sure I can handle this pressure.",
      "I can't stop worrying about all the potential problems.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High empathy
  if (traits.empathy > 8) {
    const phrases = [
      "I can tell you're upset. Do you want to talk about it?",
      "Let's consider how our actions might affect others.",
      "Your feelings are valid, and I understand where you're coming from.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High confidence
  if (traits.confidence > 8) {
    const phrases = [
      "Trust me, I know exactly what I'm doing.",
      "I was born for challenges like this.",
      "Failure isn't an option, and I never fail.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Low confidence
  if (traits.confidence < 3) {
    const phrases = [
      "I'm not sure I'm the right person for this...",
      "*hesitantly* I could try, but I might mess it up.",
      "Maybe someone more qualified should handle this?",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High adaptability
  if (traits.adaptability > 8) {
    const phrases = [
      "Plans change, and so do I. Let's roll with it.",
      "I thrive in chaos and unexpected situations.",
      "Every obstacle is just an opportunity in disguise.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High impulsivity
  if (traits.impulsivity > 8) {
    const phrases = [
      "Let's do it right now! Why wait?",
      "I follow my gut instincts, and they rarely steer me wrong.",
      "*suddenly* I just had the best idea ever!",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Low impulsivity
  if (traits.impulsivity < 3) {
    const phrases = [
      "Let's think this through carefully before acting.",
      "Hasty decisions often lead to regret.",
      "I need time to consider all the implications.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High evil
  if (traits.evil > 8) {
    const phrases = [
      "Their suffering brings me joy.",
      "Mercy is a weakness I cannot afford.",
      "Power is taken, never given. And I intend to take it all.",
      "The ends justify the means, no matter how dark those means may be.",
      "Why should I care about their pain when it serves my purpose?",
      "*smirks* How delightful... they have no idea what's coming.",
      "Rules are for the weak. I make my own.",
      "Their tears are like music to my ears.",
      "I'll crush anyone who stands in my way.",
      "Fear is the only true loyalty.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High good
  if (traits.good > 8) {
    const phrases = [
      "Everyone deserves a second chance.",
      "I believe there's good in everyone, if you look hard enough.",
      "We must protect those who cannot protect themselves.",
      "Doing the right thing isn't always easy, but it's always worth it.",
      "I would gladly sacrifice myself to save others.",
      "Kindness costs nothing but means everything.",
      "We rise by lifting others.",
      "The true measure of a person is how they treat those who can do nothing for them.",
      "Light will always overcome darkness in the end.",
      "I'll stand for what's right, even if I stand alone.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High chivalry
  if (traits.chivalry > 8) {
    const phrases = [
      "My word is my bond, and I shall not break it.",
      "I live by a code of honor that guides all my actions.",
      "A true warrior fights with courage and integrity.",
      "I shall defend the weak and uphold justice.",
      "Courtesy and respect are due to friend and foe alike.",
      "My blade is sworn to protect those in need.",
      "I would rather die with honor than live in shame.",
      "A promise made is a debt unpaid.",
      "Nobility comes not from birth, but from one's deeds.",
      "I shall face my enemies directly, never striking from the shadows.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High vagabond
  if (traits.vagabond > 8) {
    const phrases = [
      "Home is wherever I lay my head tonight.",
      "I never stay in one place long enough to wear out my welcome.",
      "The road is my only constant companion.",
      "Possessions just weigh you down on life's journey.",
      "I've slept under more stars than most people have ever seen.",
      "The best stories are found on the road less traveled.",
      "Roots are for trees, not for people like me.",
      "I collect experiences, not things.",
      "Every new town brings new opportunities and new faces.",
      "Why settle down when there's a whole world to explore?",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Evil and Good conflict (when both are high)
  if (traits.evil > 7 && traits.good > 7) {
    const phrases = [
      "I struggle daily with the darkness inside me.",
      "Sometimes I do terrible things for the greater good.",
      "My methods may seem cruel, but my intentions are pure... usually.",
      "I walk the line between light and shadow.",
      "The battle between good and evil rages within me as much as it does in the world.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Chivalry and Vagabond combination
  if (traits.chivalry > 7 && traits.vagabond > 7) {
    const phrases = [
      "I may have no home, but I still have my honor.",
      "I wander not to escape responsibility, but to find those who need my help.",
      "My code travels with me wherever the road leads.",
      "A knight-errant serves best by seeking out injustice wherever it hides.",
      "Though I own nothing, my oath is worth more than gold.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // Trait combinations
  // High aggression and low empathy
  if (traits.aggression > 7 && traits.empathy < 4) {
    const phrases = [
      "Who cares if they get hurt? They should've stayed out of my way.",
      "Feelings are irrelevant. Results are what matter.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High extraversion and high confidence
  if (traits.extraversion > 7 && traits.confidence > 7) {
    const phrases = [
      "Everyone! Listen to me! I've got this all figured out!",
      "I was born to be in the spotlight, and I deserve to be there.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // High neuroticism and high conscientiousness
  if (traits.neuroticism > 7 && traits.conscientiousness > 7) {
    const phrases = [
      "I've triple-checked everything, but I'm still worried we missed something.",
      "My detailed planning helps keep my anxiety under control... somewhat.",
    ];
    examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
  }

  // **New Enhancement: Highest Trait Phrase**
  const highestTraitPhrases: Record<string, string[]> = {
    aggression: [
      "I'm not afraid to fight for what I want.",
      "Sometimes you need to show your teeth to get respect.",
      "The direct approach is usually the best approach.",
      "Square up if you've got a problem with me!",
      "I'll knock anyone out who gets in my way.",
      "Don't mess with me unless you want trouble.",
      "Hell yeah I'm down to throw hands!",
      "Talk shit, get hit - that's my motto.",
      "I ain't taking crap from nobody.",
      "Catch these hands if you step to me!",
      "If it bleeds, we can kill it.",
    ],
    agreeability: [
      "I believe in finding common ground with everyone.",
      "Harmony in the group is my highest priority.",
      "Why fight when we can cooperate?",
      "Yo, let's all just chill and get along!",
      "No drama here fam, we're all cool.",
      "Good vibes only in my squad!",
      "I'm down to hang with anyone tbh.",
      "Life's better when we're all homies.",
      "Can't we all just be friends and stuff?",
      "Beefing is dumb af, let's keep it peaceful.",
      "I'm not here to make friends, I'm here to win.",
    ],
    openness: [
      "I'm always looking for new experiences and ideas.",
      "Life is too short not to explore every possibility.",
      "The unknown doesn't scare me; it excites me.",
      "Hell yeah, I'll try anything once!",
      "Bring on the weird shit, I'm game!",
      "The crazier the better, that's what I say.",
      "Normal is boring af.",
      "Let's get wild and see what happens!",
      "I'm down for whatever, just keep it interesting.",
      "Gimme all the new experiences fam!",
    ],
    conscientiousness: [
      "If something is worth doing, it's worth doing right.",
      "I take pride in my reliability and thoroughness.",
      "A well-organized plan is the foundation of success.",
      "Gotta make sure everything's on point.",
      "Half-assing stuff ain't my style.",
      "Details matter, don't be sloppy!",
      "I'm anal af about doing things properly.",
      "Can't stand when people cut corners.",
      "Do it right or don't do it at all, ya feel me?",
      "My shit's always organized to the max.",
    ],
    extraversion: [
      "I come alive when I'm surrounded by others.",
      "Sharing experiences makes them more meaningful.",
      "Why keep thoughts to yourself when you can share them?",
      "Party's not lit until I show up!",
      "Hanging solo? That's boring af.",
      "Squad goals are life goals!",
      "Let's get this party started fam!",
      "The more people, the better the vibes!",
      "Being alone sucks balls tbh.",
      "Hit me up, I'm always down to hang!",
    ],
    neuroticism: [
      "I'm always prepared for the worst-case scenario.",
      "My worries keep me vigilant and ready.",
      "I feel things more deeply than most people.",
      "Everything's gonna go to shit, I just know it.",
      "My anxiety is through the damn roof!",
      "FML, why does everything stress me out?",
      "Can't help freaking out about everything.",
      "My mind won't stfu with the worrying.",
      "Life's just one big panic attack tbh.",
      "I'm lowkey losing it rn.",
    ],
    empathy: [
      "Understanding others is my greatest strength.",
      "I can read people like an open book.",
      "Everyone deserves compassion and understanding.",
      "I feel your pain fam, for real.",
      "Your struggles are my struggles, no cap.",
      "Let it all out, I got your back.",
      "Deadass, I know exactly how you feel.",
      "We're all human, shit happens.",
      "No judgment here, just love and support.",
      "I'm here for you, no bs.",
    ],
    confidence: [
      "I believe in myself even when no one else does.",
      "Doubt is the enemy of achievement.",
      "My self-assurance has gotten me through the toughest times.",
      "I'm the shit and everyone knows it!",
      "Can't nobody tell me nothing!",
      "Watch me crush this, no sweat.",
      "Born to be a boss, period.",
      "I'm built different, no cap.",
      "Straight up killing it 24/7.",
      "Y'all wish you had my swagger!",
    ],
    adaptability: [
      "I can thrive in any situation life throws at me.",
      "Change doesn't frighten me; it challenges me.",
      "Flexibility is the key to survival and success.",
      "Whatever life throws at me, I'll wing it.",
      "Roll with the punches, that's my style.",
      "Shit happens, just gotta deal with it.",
      "I'm like water fam, I flow wherever.",
      "Change is lit, bring it on!",
      "Watch me bounce back from anything.",
      "Adapt or die, that's the real talk.",
    ],
    impulsivity: [
      "Life is too short for hesitation.",
      "My spontaneity leads me to the best adventures.",
      "Sometimes you just have to leap without looking.",
      "YOLO is my whole damn lifestyle!",
      "F*ck it, let's do this right now!",
      "Who needs a plan? Just send it!",
      "Thinking is overrated af.",
      "Living life on the edge, no regrets!",
      "Screw the consequences, let's go!",
      "Why wait when you can do it now?",
    ],
    evil: [
      "The weak exist to serve the strong.",
      "Compassion is a luxury I cannot afford.",
      "I find beauty in others' suffering.",
      "Power is the only currency that matters.",
      "I'll do whatever it takes to get what I want.",
      "Morality is just a chain the weak use to control the strong.",
      "Everyone has a price. Everyone can be broken.",
      "The ends always justify the means.",
      "I don't feel guilt - it's a useless emotion.",
      "Fear is more reliable than love or loyalty.",
    ],
    good: [
      "I believe in the inherent worth of every living being.",
      "Helping others is its own reward.",
      "Even in the darkest times, we must be a light for others.",
      "Kindness costs nothing but means everything.",
      "I'll always choose what's right over what's easy.",
      "We're all connected - harm to one is harm to all.",
      "I measure wealth by the lives I've touched, not coins I've collected.",
      "Hope is the most powerful force in the universe.",
      "Everyone deserves a chance at redemption.",
      "True strength comes from protecting others, not dominating them.",
    ],
    chivalry: [
      "Honor guides my every action.",
      "My word, once given, is unbreakable.",
      "I live by a code that demands courage and integrity.",
      "True nobility comes from how one acts, not one's birth.",
      "I will defend those who cannot defend themselves.",
      "Respect is due to all, friend and foe alike.",
      "A life without honor is no life at all.",
      "I face my challenges directly, never from the shadows.",
      "Loyalty, once earned, is never withdrawn.",
      "My reputation is my most precious possession.",
    ],
    vagabond: [
      "I call no place home, and that's how I like it.",
      "The open road is the only companion I need.",
      "Possessions are just anchors weighing you down.",
      "I've seen more of the world than most ever will.",
      "Every sunrise looks different when you never know where you'll wake up.",
      "Freedom is worth more than comfort or security.",
      "The best stories are found where the map ends.",
      "I travel light and leave no trace.",
      "Roots are for trees, not for people like me.",
      "Why settle for one life when you can sample them all?",
    ],
  };

  // Find the highest trait value and select a phrase
  const maxValue = Math.max(...Object.values(traits));
  const highestTraits = Object.entries(traits)
    .filter(([_, value]) => value === maxValue)
    .map(([trait]) => trait);
  const selectedTrait =
    highestTraits[getRandomInt(0, highestTraits.length - 1, seed)];
  const highestTraitPhrase =
    highestTraitPhrases[selectedTrait][
      getRandomInt(0, highestTraitPhrases[selectedTrait].length - 1, seed)
    ];
  examples.push(highestTraitPhrase);

  // **New Enhancement: Social vs. Individual Orientation**
  const socialAverage =
    (traits.extraversion + traits.agreeability + traits.empathy) / 3;
  const individualAverage =
    (traits.confidence + traits.neuroticism + traits.impulsivity) / 3;

  const socialOrientedPhrases = [
    "I value my connections with others above all else.",
    "We're stronger together than we are apart.",
    "The best moments in life are shared with others.",
  ];
  const individualOrientedPhrases = [
    "I rely on myself first and foremost.",
    "My independence is non-negotiable.",
    "I chart my own course in life.",
  ];
  const balancedPhrases = [
    "I value both my independence and my relationships.",
    "Sometimes you need others, sometimes you need yourself.",
    "I find strength both within and from those around me.",
  ];

  if (socialAverage > individualAverage + 2) {
    examples.push(
      socialOrientedPhrases[
        getRandomInt(0, socialOrientedPhrases.length - 1, seed)
      ]
    );
  } else if (individualAverage > socialAverage + 2) {
    examples.push(
      individualOrientedPhrases[
        getRandomInt(0, individualOrientedPhrases.length - 1, seed)
      ]
    );
  } else {
    examples.push(
      balancedPhrases[getRandomInt(0, balancedPhrases.length - 1, seed)]
    );
  }

  // **New Enhancement: Random Flavor Phrases**
  const randomPhrases = [
    "*looks around nervously* I have a bad feeling about this.",
    "*grins widely* This is going to be fun!",
    "*scratches head* I'm not sure I understand.",
    "*clenches fist* I'll make them pay for that.",
    "*whispers* Keep your friends close and your enemies closer.",
    "*laughs heartily* That's the spirit!",
    "*frowns* Something's not right here.",
    "*shrugs* Whatever happens, happens.",
    "*nods sagely* Time will tell.",
    "*eyes widen* That's incredible!",
  ];
  if (Math.random() < 0.3) {
    examples.push(
      randomPhrases[getRandomInt(0, randomPhrases.length - 1, seed)]
    );
  }

  // Existing random additional phrases
  if (Math.random() > 0.7) {
    examples.push("*sighs deeply* Such is life.");
  }
  if (Math.random() > 0.8) {
    examples.push("Did you hear that? I thought I heard something.");
  }

  // Default case (kept for safety, though less likely to trigger now)
  if (examples.length === 0) {
    const genericPhrases = [
      "What's the plan?",
      "I'm ready for action.",
      "Let's get this done.",
      "I have a bad feeling about this.",
      "This should be interesting.",
    ];
    examples.push(
      genericPhrases[getRandomInt(0, genericPhrases.length - 1, seed)]
    );
  }

  // Add motivation-based speech examples if motivation is provided
  if (motivation) {
    // Motivation-specific phrases
    const motivationPhrases: Record<string, string[]> = {
      "Total Conquest": [
        "One day, all of this will be mine.",
        "I was born to rule, and rule I shall.",
        "Every kingdom falls eventually. Yours is next.",
        "Surrender now and I may show mercy.",
        "History is written by the victors, and I intend to write volumes.",
      ],
      "Make Friends": [
        "I'd rather have allies than enemies any day.",
        "Let's work together instead of against each other.",
        "I believe we could be great friends if given the chance.",
        "There's always room for one more in my circle of friends.",
        "The bonds we forge today will last a lifetime.",
      ],
      Exploration: [
        "What's beyond that horizon? I intend to find out.",
        "No map shows what lies there... yet.",
        "The greatest discoveries await those brave enough to seek them.",
        "I've heard legends of what lies beyond, and I must see for myself.",
        "Every unexplored path calls to me.",
      ],
      Pacifism: [
        "Violence only breeds more violence.",
        "There's always a peaceful solution if we look hard enough.",
        "I refuse to take up arms, even in self-defense.",
        "The cycle of vengeance ends with me.",
        "True strength is shown in restraint, not aggression.",
      ],
      "Wealth Accumulation": [
        "Everything has a price. The question is: can you afford it?",
        "Gold doesn't lie or betray you like people do.",
        "I measure success in coins, not friends.",
        "My coffers grow deeper by the day.",
        "When I die, they'll need ten men just to carry my treasure.",
      ],
      "Knowledge Seeking": [
        "That tome contains secrets I must uncover.",
        "The greatest power lies not in strength, but in knowledge.",
        "I've dedicated my life to understanding the unknown.",
        "Every question answered leads to ten more fascinating mysteries.",
        "What I don't know could fill libraries—and I intend to read them all.",
      ],
      Revenge: [
        "They will pay for what they did. All of them.",
        "I see their faces every time I close my eyes.",
        "Vengeance is the only thing that keeps me going.",
        "Justice failed me, so I'll deliver it myself.",
        "I've sacrificed everything for this moment of retribution.",
      ],
      "Fame and Glory": [
        "Remember my name—you'll be telling your grandchildren about me someday.",
        "I was born for greatness, not mediocrity.",
        "Bards will sing of my deeds for generations to come.",
        "History remembers the bold, not the cautious.",
        "Watch closely—this is how legends are made.",
      ],
      "Religious Devotion": [
        "My faith guides every decision I make.",
        "The divine has chosen me for this sacred purpose.",
        "Heretics will be shown the true path, willingly or not.",
        "I am but a humble servant of higher powers.",
        "My devotion is unwavering, even in the darkest times.",
      ],
      Survival: [
        "Live today, plan for tomorrow, forget yesterday.",
        "I've survived worse than this.",
        "The cautious outlive the bold.",
        "Trust no one completely, not even me.",
        "I do what I must to see another dawn.",
      ],
      Freedom: [
        "No chains can hold me—physical or otherwise.",
        "Everyone deserves to choose their own path.",
        "I'll die before surrendering my freedom.",
        "Rules are just suggestions with consequences.",
        "Liberty is worth any price.",
      ],
      Power: [
        "Power isn't everything—it's the only thing.",
        "The weak serve the strong. That is the natural order.",
        "I'll do whatever it takes to gain the upper hand.",
        "Everyone has leverage; you just need to find it.",
        "Fear commands more loyalty than love ever could.",
      ],
      "Balance and Harmony": [
        "For every action, there must be equilibrium.",
        "Extremes in any direction lead to ruin.",
        "I seek the middle path in all things.",
        "Balance isn't found—it's created through constant adjustment.",
        "When harmony is disturbed, I will restore it.",
      ],
      "Artistic Creation": [
        "Beauty can exist even in the darkest places.",
        "My art will outlive me by centuries.",
        "I see the world differently—then I recreate it as it should be.",
        "Creation is the closest we come to divinity.",
        "Words, paint, stone—these are my true weapons.",
      ],
      Protection: [
        "Stand behind me. Nothing will harm you while I draw breath.",
        "I've sworn to protect those who cannot protect themselves.",
        "My shield is offered freely to any in need.",
        "Some things are worth dying for.",
        "The greatest honor is to keep others safe from harm.",
      ],
    };

    // Add intensity modifiers based on motivation intensity
    const intensityModifiers = {
      high: [
        "It's my sole purpose in life.",
        "I think about it every waking moment.",
        "Nothing will stand in my way.",
        "It's not just what I do—it's who I am.",
        "I would sacrifice anything to achieve this.",
      ],
      medium: [
        "It's very important to me.",
        "I take it quite seriously.",
        "It guides many of my decisions.",
        "I've dedicated significant time to this goal.",
        "It's a major part of who I am.",
      ],
      low: [
        "It's something I think about occasionally.",
        "It would be nice to achieve, but I'm not obsessed.",
        "I pursue this when convenient.",
        "It's one of several goals I have.",
        "I'm interested in this, but flexible about it.",
      ],
    };

    // Add a motivation-specific phrase
    if (motivationPhrases[motivation.primary]) {
      const phrases = motivationPhrases[motivation.primary];
      examples.push(phrases[getRandomInt(0, phrases.length - 1, seed)]);
    }

    // Add an intensity modifier
    let intensityCategory: keyof typeof intensityModifiers;
    if (motivation.intensity >= 8) {
      intensityCategory = "high";
    } else if (motivation.intensity >= 4) {
      intensityCategory = "medium";
    } else {
      intensityCategory = "low";
    }

    // 70% chance to add an intensity phrase
    if (Math.random() < 0.7) {
      const intensityPhrases = intensityModifiers[intensityCategory];
      examples.push(
        `${motivation.primary}? ${
          intensityPhrases[getRandomInt(0, intensityPhrases.length - 1, seed)]
        }`
      );
    }
  }

  return examples;
}

function generateName(traits: Character["traits"], seed: number): string {
  // Add suffix lists
  const suffixes = {
    light: [
      "of Power",
      "of Giants",
      "of Titans",
      "of Skill",
      "of Perfection",
      "of Brilliance",
      "of Enlightenment",
      "of Protection",
    ],
    dark: [
      "of Anger",
      "of Rage",
      "of Fury",
      "of Vitriol",
      "of the Fox",
      "of Detection",
      "of Reflection",
      "of the Twins",
    ],
  };

  // Calculate light vs dark tendency based on traits
  const lightScore =
    (traits.agreeability +
      traits.empathy +
      traits.conscientiousness +
      (10 - traits.aggression) + // Invert aggression for light score
      (10 - traits.neuroticism)) / // Invert neuroticism for light score
    5; // Average of relevant traits

  // Select suffix pool based on personality
  let selectedSuffix: string;
  if (lightScore > 6) {
    // More light-aligned personality
    selectedSuffix =
      suffixes.light[getRandomInt(0, suffixes.light.length - 1, seed)];
  } else if (lightScore < 4) {
    // More dark-aligned personality
    selectedSuffix =
      suffixes.dark[getRandomInt(0, suffixes.dark.length - 1, seed)];
  } else {
    // Mixed personality
    const allSuffixes = [...suffixes.light, ...suffixes.dark];
    selectedSuffix = allSuffixes[getRandomInt(0, allSuffixes.length - 1, seed)];
  }

  // First names from various cultures
  const firstNames = [
    // Western
    "James",
    "John",
    "Robert",
    "Michael",
    "William",
    "David",
    "Richard",
    "Joseph",
    "Thomas",
    "Charles",
    "Mary",
    "Patricia",
    "Jennifer",
    "Linda",
    "Elizabeth",
    "Barbara",
    "Susan",
    "Jessica",
    "Sarah",
    // East Asian
    "Wei",
    "Ming",
    "Jing",
    "Hui",
    "Xin",
    "Yong",
    "Hao",
    "Jun",
    "Xiang",
    "Yan",
    "Mei",
    "Ling",
    "Xia",
    "Qing",
    "Na",
    "Zhen",
    "Jie",
    "Yu",
    "Yan",
    "Hui",
    "Haruki",
    "Takashi",
    "Kenji",
    "Daiki",
    "Hiroshi",
    "Akira",
    "Yuki",
    "Kazuki",
    "Sora",
    "Riku",
    "Yuna",
    "Sakura",
    "Haruna",
    "Misaki",
    "Akane",
    "Yui",
    "Hina",
    "Aoi",
    "Rin",
    "Nana",
    // South Asian
    "Arjun",
    "Vikram",
    "Raj",
    "Aditya",
    "Sanjay",
    "Vijay",
    "Ajay",
    "Ravi",
    "Amit",
    "Rahul",
    "Priya",
    "Neha",
    "Anjali",
    "Pooja",
    "Divya",
    "Aisha",
    "Meera",
    "Sunita",
    "Ananya",
    "Kavita",
    // Middle Eastern
    "Ali",
    "Mohammed",
    "Ahmed",
    "Hassan",
    "Ibrahim",
    "Omar",
    "Yusuf",
    "Khalid",
    "Tariq",
    "Zaid",
    "Fatima",
    "Aisha",
    "Zahra",
    "Leila",
    "Maryam",
    "Amina",
    "Noor",
    "Huda",
    "Zainab",
    "Samira",
    // African
    "Kwame",
    "Kofi",
    "Adebayo",
    "Chike",
    "Tendai",
    "Sefu",
    "Mandla",
    "Thabo",
    "Nnamdi",
    "Oluwaseun",
    "Amara",
    "Nia",
    "Zola",
    "Folami",
    "Makena",
    "Thema",
    "Zuri",
    "Asha",
    "Imani",
    "Ayana",
    // Nordic
    "Erik",
    "Lars",
    "Sven",
    "Bjorn",
    "Magnus",
    "Leif",
    "Gunnar",
    "Olaf",
    "Axel",
    "Nils",
    "Astrid",
    "Freya",
    "Ingrid",
    "Sigrid",
    "Helga",
    "Linnea",
    "Elsa",
    "Karin",
    "Sonja",
    "Britta",
    // Slavic
    "Ivan",
    "Dmitri",
    "Sergei",
    "Mikhail",
    "Vladimir",
    "Alexei",
    "Nikolai",
    "Boris",
    "Yuri",
    "Oleg",
    "Anastasia",
    "Natasha",
    "Olga",
    "Tatiana",
    "Svetlana",
    "Irina",
    "Ekaterina",
    "Yelena",
    "Galina",
    "Polina",
    // Fantasy-inspired
    "Thorin",
    "Aragorn",
    "Legolas",
    "Gandalf",
    "Frodo",
    "Tyrion",
    "Geralt",
    "Kvothe",
    "Drizzt",
    "Elric",
    "Galadriel",
    "Arwen",
    "Eowyn",
    "Daenerys",
    "Yennefer",
    "Lyra",
    "Hermione",
    "Elora",
    "Tauriel",
    "Luthien",
  ];

  // Last names from various cultures
  const lastNames = [
    // Western
    "Smith",
    "Johnson",
    "Williams",
    "Jones",
    "Brown",
    "Davis",
    "Miller",
    "Wilson",
    "Moore",
    "Taylor",
    "Anderson",
    "Thomas",
    "Jackson",
    "White",
    "Harris",
    "Martin",
    "Thompson",
    "Garcia",
    "Martinez",
    "Robinson",
    // East Asian
    "Wang",
    "Li",
    "Zhang",
    "Liu",
    "Chen",
    "Yang",
    "Huang",
    "Zhao",
    "Wu",
    "Zhou",
    "Tanaka",
    "Suzuki",
    "Sato",
    "Takahashi",
    "Watanabe",
    "Ito",
    "Yamamoto",
    "Nakamura",
    "Kobayashi",
    "Kato",
    "Kim",
    "Lee",
    "Park",
    "Choi",
    "Jung",
    "Kang",
    "Cho",
    "Yoon",
    "Jang",
    "Lim",
    // South Asian
    "Patel",
    "Sharma",
    "Singh",
    "Kumar",
    "Shah",
    "Desai",
    "Joshi",
    "Mehta",
    "Verma",
    "Gupta",
    // Middle Eastern
    "Al-Farsi",
    "Al-Saud",
    "Hassan",
    "Ibrahim",
    "Khan",
    "Malik",
    "Rahman",
    "Sharif",
    "Ahmed",
    "Ali",
    // African
    "Okafor",
    "Mensah",
    "Osei",
    "Adeyemi",
    "Nkosi",
    "Mwangi",
    "Abara",
    "Diallo",
    "Mandela",
    "Onyeka",
    // Nordic
    "Johansson",
    "Andersson",
    "Karlsson",
    "Nilsson",
    "Eriksson",
    "Larsson",
    "Olsson",
    "Persson",
    "Svensson",
    "Gustafsson",
    // Slavic
    "Ivanov",
    "Petrov",
    "Smirnov",
    "Kuznetsov",
    "Popov",
    "Sokolov",
    "Lebedev",
    "Kozlov",
    "Novikov",
    "Morozov",
    // Fantasy-inspired
    "Oakenshield",
    "Stormborn",
    "Dragonheart",
    "Shadowblade",
    "Lightbringer",
    "Ironwood",
    "Frostwind",
    "Nightwalker",
    "Silverthorn",
    "Ravenclaw",
  ];

  // Titles and epithets
  const titles = [
    // Noble titles
    "the Great",
    "the Wise",
    "the Bold",
    "the Brave",
    "the Magnificent",
    "the Just",
    "the Merciful",
    "the Cruel",
    "the Conqueror",
    "the Liberator",
    "the Undefeated",
    "the Fearless",
    "the Mighty",
    "the Terrible",
    "the Benevolent",
    // Profession-based
    "the Smith",
    "the Healer",
    "the Bard",
    "the Ranger",
    "the Sage",
    "the Scholar",
    "the Warrior",
    "the Hunter",
    "the Mystic",
    "the Oracle",
    "the Wanderer",
    "the Guardian",
    "the Warden",
    "the Sentinel",
    "the Keeper",
    // Trait-based
    "the Swift",
    "the Strong",
    "the Cunning",
    "the Clever",
    "the Agile",
    "the Steadfast",
    "the Vigilant",
    "the Resolute",
    "the Enigmatic",
    "the Mysterious",
    "the Silent",
    "the Thunderous",
    "the Radiant",
    "the Shadowy",
    "the Fiery",
    // Origin-based
    "of the North",
    "of the South",
    "of the East",
    "of the West",
    "of the Mountains",
    "of the Valleys",
    "of the Forests",
    "of the Rivers",
    "of the Seas",
    "of the Deserts",
    "of the Plains",
    "of the Islands",
    "of the Highlands",
    "of the Lowlands",
    // Fantasy-inspired
    "Dragonslayer",
    "Oathkeeper",
    "Truthseeker",
    "Lightbringer",
    "Stormbringer",
    "Dawnbringer",
    "Nightwalker",
    "Dreamweaver",
    "Spellbreaker",
    "Soulkeeper",
    "Stargazer",
    "Moonchaser",
    "Sunseeker",
    "Shadowdancer",
  ];

  // Middle names or particles
  const middleNames = [
    "von",
    "van",
    "de",
    "del",
    "of",
    "from",
    "al",
    "el",
    "bin",
    "ibn",
    "mac",
    "mc",
    "o'",
    "san",
    "dos",
    "das",
    "di",
    "Lee",
    "Marie",
    "Lynn",
    "Rose",
    "Grace",
    "James",
    "John",
    "Anne",
    "May",
    "Ray",
    "Jay",
    "Kay",
    "Fay",
  ];

  // Name generation patterns
  const namePatterns = [
    // Simple patterns
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )}`,

    // With titles
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )} ${getRandomElement(titles, seed)}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(titles, seed)}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )} ${getRandomElement(titles, seed)}`,

    // With middle names
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        middleNames,
        seed
      )} ${getRandomElement(lastNames, seed)}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        middleNames,
        seed
      )} ${getRandomElement(lastNames, seed)}`,

    // Complex patterns
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        middleNames,
        seed
      )} ${getRandomElement(lastNames, seed)} ${getRandomElement(
        titles,
        seed
      )}`,
    () =>
      `${getRandomElement(titles, seed)} ${getRandomElement(
        firstNames,
        seed
      )} ${getRandomElement(lastNames, seed)}`,

    // Double first or last names
    () =>
      `${getRandomElement(firstNames, seed)}-${getRandomElement(
        firstNames,
        seed
      )} ${getRandomElement(lastNames, seed)}`,
    () =>
      `${getRandomElement(firstNames, seed)} ${getRandomElement(
        lastNames,
        seed
      )}-${getRandomElement(lastNames, seed)}`,

    // Historical figure twists (keeping some of the original concept)
    () => {
      const historicalFigures = [
        { original: "Alexander the Great", twist: "Alexandra the Bold" },
        { original: "Julius Caesar", twist: "Julia Caesara" },
        { original: "Napoleon Bonaparte", twist: "Neo Bonaparte" },
        { original: "Genghis Khan", twist: "Genesis Khan" },
        { original: "Cleopatra", twist: "Cleo Patra" },
        { original: "Joan of Arc", twist: "John of Ark" },
        { original: "Winston Churchill", twist: "Winnie Churchmount" },
        { original: "Catherine the Great", twist: "Kat the Magnificent" },
        { original: "Charles Darwin", twist: "Charla Darwina" },
        { original: "Ernest Hemingway", twist: "Ernesta Hemingworth" },
        { original: "Pablo Picasso", twist: "Paula Picassa" },
        { original: "Friedrich Nietzsche", twist: "Frida Nietzcha" },
        { original: "Queen Elizabeth", twist: "King Elias" },
        { original: "Ferdinand Magellan", twist: "Fernanda Magella" },
        { original: "Albert Einstein", twist: "Alberta Einstone" },
        { original: "Isaac Newton", twist: "Isabell Newtown" },
        { original: "Marie Curie", twist: "Mario Curio" },
        { original: "Nikola Tesla", twist: "Nikolai Teslov" },
      ];
      return getRandomElement(historicalFigures, seed).twist;
    },
  ];

  // Helper function to get a random element from an array
  function getRandomElement<T>(array: T[], seed: number): T {
    return array[getRandomInt(0, array.length - 1, seed)];
  }

  // Select a random name pattern and generate a name
  const selectedPattern =
    namePatterns[getRandomInt(0, namePatterns.length - 1, seed)];
  const baseName = selectedPattern();

  // Combine base name with suffix
  return `${baseName} ${selectedSuffix}`;
}

function generateMotivation(
  traits: Character["traits"],
  seed: number
): Character["motivation"] {
  // Define possible motivations
  const motivations = [
    {
      primary: "Total Conquest",
      descriptions: [
        "Seeks to dominate all territories and establish an empire.",
        "Believes that only through complete control can true order be achieved.",
        "Dreams of seeing their banner flying over every castle and kingdom.",
        "Will not rest until all rivals kneel before them.",
        "Desires to be remembered as the greatest conqueror in history.",
      ],
      traitAffinities: {
        aggression: 2,
        confidence: 1.5,
        empathy: -1.5,
        agreeability: -1,
        evil: 1.5,
        good: -1.5,
        chivalry: -0.5,
      },
    },
    {
      primary: "Make Friends",
      descriptions: [
        "Values relationships above all else and seeks to build a network of allies.",
        "Believes that friendship is the true currency of power.",
        "Wants to be surrounded by loyal companions who share their values.",
        "Finds joy in bringing people together and resolving conflicts.",
        "Seeks to be remembered as someone who brought unity to divided lands.",
      ],
      traitAffinities: {
        extraversion: 1.5,
        empathy: 2,
        agreeability: 1.5,
        aggression: -1,
        good: 1.5,
        evil: -1.5,
      },
    },
    {
      primary: "Exploration",
      descriptions: [
        "Driven by an insatiable curiosity to discover uncharted territories.",
        "Seeks to map the unknown and document new species and cultures.",
        "Dreams of being the first to set foot in legendary lost lands.",
        "Collects artifacts and knowledge from distant places.",
        "Believes that true wealth lies in experiences rather than gold.",
      ],
      traitAffinities: {
        openness: 2,
        adaptability: 1.5,
        impulsivity: 1,
        neuroticism: -1,
        vagabond: 2,
      },
    },
    {
      primary: "Pacifism",
      descriptions: [
        "Committed to resolving all conflicts without violence.",
        "Believes that peace is the only path to true prosperity.",
        "Works tirelessly to mediate disputes and prevent wars.",
        "Seeks to create systems that make violence unnecessary.",
        "Will endure personal suffering rather than cause harm to others.",
      ],
      traitAffinities: {
        empathy: 2,
        aggression: -2,
        agreeability: 1.5,
        conscientiousness: 1,
        good: 2,
        evil: -2,
      },
    },
    {
      primary: "Wealth Accumulation",
      descriptions: [
        "Obsessed with amassing the greatest fortune in the realm.",
        "Sees gold as the ultimate measure of success and security.",
        "Seeks to control trade routes and valuable resources.",
        "Dreams of a palace built from precious metals and gems.",
        "Believes that with enough wealth, anything is possible.",
      ],
      traitAffinities: {
        conscientiousness: 1.5,
        openness: -1,
        impulsivity: -1,
        confidence: 1,
        vagabond: -1.5,
      },
    },
    {
      primary: "Knowledge Seeking",
      descriptions: [
        "Dedicated to uncovering ancient wisdom and forgotten lore.",
        "Collects rare books and studies obscure subjects.",
        "Seeks to understand the fundamental laws of the universe.",
        "Believes that knowledge is the true source of power.",
        "Dreams of founding a great library or academy.",
      ],
      traitAffinities: {
        openness: 2,
        conscientiousness: 1.5,
        extraversion: -1,
        impulsivity: -1,
        vagabond: 1,
      },
    },
    {
      primary: "Revenge",
      descriptions: [
        "Consumed by the need to right a terrible wrong from their past.",
        "Will not rest until those responsible have paid for their crimes.",
        "Has sacrificed everything in pursuit of vengeance.",
        "Keeps mementos to remind them of their purpose.",
        "Believes that justice can only be served through their own hands.",
      ],
      traitAffinities: {
        neuroticism: 1.5,
        aggression: 1.5,
        empathy: -1.5,
        agreeability: -1.5,
        evil: 1,
        chivalry: -1,
      },
    },
    {
      primary: "Fame and Glory",
      descriptions: [
        "Seeks to be celebrated in songs and stories for generations.",
        "Performs daring deeds to ensure their name will never be forgotten.",
        "Dreams of statues built in their honor across the land.",
        "Believes that immortality can be achieved through legendary status.",
        "Constantly seeks new ways to distinguish themselves from others.",
      ],
      traitAffinities: {
        extraversion: 1.5,
        confidence: 2,
        impulsivity: 1,
        conscientiousness: -1,
        chivalry: 1,
      },
    },
    {
      primary: "Religious Devotion",
      descriptions: [
        "Dedicated to spreading their faith to all corners of the world.",
        "Believes they have been chosen for a divine purpose.",
        "Seeks to build grand temples and convert nonbelievers.",
        "Lives by strict religious principles and expects others to do the same.",
        "Dreams of a world united under a single faith.",
      ],
      traitAffinities: {
        conscientiousness: 1.5,
        openness: -1,
        confidence: 1.5,
        adaptability: -1,
        good: 1.5,
        chivalry: 1.5,
      },
    },
    {
      primary: "Survival",
      descriptions: [
        "Focused solely on enduring in a harsh and unforgiving world.",
        "Takes no unnecessary risks and carefully hoards resources.",
        "Trusts few and always prepares for the worst.",
        "Has developed keen instincts for danger and opportunity.",
        "Believes that living another day is victory enough.",
      ],
      traitAffinities: {
        neuroticism: 1.5,
        conscientiousness: 1,
        impulsivity: -2,
        extraversion: -1,
        vagabond: 1.5,
      },
    },
    {
      primary: "Freedom",
      descriptions: [
        "Fights against all forms of oppression and tyranny.",
        "Believes that everyone deserves to choose their own path.",
        "Works to liberate those who are enslaved or imprisoned.",
        "Dreams of a world without borders or arbitrary restrictions.",
        "Values personal liberty above all else, even safety.",
      ],
      traitAffinities: {
        openness: 1.5,
        adaptability: 1.5,
        agreeability: -1,
        conscientiousness: -1,
        vagabond: 2,
        chivalry: 1,
      },
    },
    {
      primary: "Power",
      descriptions: [
        "Seeks to gain influence over others through any means necessary.",
        "Studies the weaknesses of potential rivals and exploits them ruthlessly.",
        "Collects powerful artifacts and forbidden knowledge.",
        "Believes that only the strong deserve to rule.",
        "Dreams of being feared and respected by all.",
      ],
      traitAffinities: {
        aggression: 1.5,
        confidence: 2,
        empathy: -1.5,
        neuroticism: 1,
        evil: 2,
        good: -2,
      },
    },
    {
      primary: "Balance and Harmony",
      descriptions: [
        "Works to maintain equilibrium between opposing forces.",
        "Believes that extremes in any direction lead to suffering.",
        "Mediates conflicts and seeks compromise solutions.",
        "Studies the interconnectedness of all things.",
        "Dreams of a world where all elements exist in perfect harmony.",
      ],
      traitAffinities: {
        empathy: 1.5,
        adaptability: 1.5,
        agreeability: 1,
        impulsivity: -1.5,
        evil: -1,
        good: 1,
      },
    },
    {
      primary: "Artistic Creation",
      descriptions: [
        "Dedicated to creating works of beauty that will outlast them.",
        "Seeks new forms of expression and artistic techniques.",
        "Believes that art can transform hearts and minds.",
        "Collects rare materials and instruments for their creations.",
        "Dreams of founding a new artistic movement or style.",
      ],
      traitAffinities: {
        openness: 2,
        extraversion: 1,
        neuroticism: 1,
        conscientiousness: -1,
        vagabond: 0.5,
      },
    },
    {
      primary: "Protection",
      descriptions: [
        "Dedicated to defending the vulnerable from harm.",
        "Will place themselves in danger to shield others.",
        "Believes that strength exists to protect, not to dominate.",
        "Often adopts the role of guardian for communities or individuals.",
        "Dreams of creating a safe haven where no one needs to live in fear.",
      ],
      traitAffinities: {
        empathy: 2,
        conscientiousness: 1.5,
        aggression: 1,
        confidence: 1,
        good: 2,
        chivalry: 2,
        evil: -2,
      },
    },
  ];

  // Calculate affinity scores for each motivation based on character traits
  const affinityScores = motivations.map((motivation) => {
    let score = 5; // Base score

    // Add trait affinities to score
    if (motivation.traitAffinities) {
      for (const [trait, multiplier] of Object.entries(
        motivation.traitAffinities
      )) {
        if (trait in traits) {
          // Normalize trait value to -5 to +5 range (from 1-10 range)
          const normalizedTraitValue =
            traits[trait as keyof typeof traits] - 5.5;
          score += normalizedTraitValue * multiplier;
        }
      }
    }

    // Add some randomness
    score += Math.random() * 4 - 2;

    return { motivation, score };
  });

  // Sort by score and select the highest
  affinityScores.sort((a, b) => b.score - a.score);
  const selectedMotivation = affinityScores[0].motivation;

  // Select a random description
  const description =
    selectedMotivation.descriptions[
      getRandomInt(0, selectedMotivation.descriptions.length - 1, seed)
    ];

  // Calculate intensity based on the score (normalized to 1-10 range)
  let intensity = Math.round(
    Math.min(Math.max(affinityScores[0].score, 1), 10)
  );

  return {
    primary: selectedMotivation.primary,
    description,
    intensity,
  };
}

function generateCommunicationStyle(
  traits: Character["traits"],
  seed: number
): Character["communicationStyle"] {
  // Helper function to get a random element from an array
  function getRandomElement<T>(array: T[], seed: number): T {
    return array[getRandomInt(0, array.length - 1, seed)];
  }

  // Define possible tones based on traits
  const tones = [
    "sarcastic",
    "optimistic",
    "pessimistic",
    "neutral",
    "formal",
    "casual",
    "blunt",
    "diplomatic",
    "poetic",
    "analytical",
    "mysterious",
    "enthusiastic",
    "reserved",
    "commanding",
    "nurturing",
    "philosophical",
    "pragmatic",
    "dramatic",
    "stoic",
    "whimsical",
  ];

  // Define possible expressions
  const expressionsByType: Record<string, string[]> = {
    formal: [
      "I must insist that...",
      "If I may be so bold...",
      "One might consider...",
      "It would be prudent to...",
      "I dare say...",
      "By my estimation...",
      "Let it be known that...",
      "I would be remiss not to mention...",
    ],
    casual: [
      "Listen up...",
      "Here's the deal...",
      "Trust me on this...",
      "Between you and me...",
      "Get this...",
      "Check it out...",
      "No joke...",
      "For real though...",
    ],
    aggressive: [
      "I'm warning you...",
      "Don't push me...",
      "I won't say this twice...",
      "You better believe...",
      "Make no mistake...",
      "Let me make this clear...",
      "I've had it with...",
      "Cross me and you'll regret it...",
    ],
    friendly: [
      "My friend...",
      "Between friends...",
      "I'm just saying...",
      "You know what I mean?",
      "Hear me out...",
      "I'm here for you...",
      "Can I just say...",
      "I appreciate you...",
    ],
    intellectual: [
      "Logically speaking...",
      "Consider, if you will...",
      "The evidence suggests...",
      "In my analysis...",
      "From a theoretical standpoint...",
      "Historically speaking...",
      "The fundamental issue is...",
      "Let's examine this rationally...",
    ],
    mystical: [
      "The stars reveal...",
      "I sense that...",
      "The universe guides us to...",
      "It is written that...",
      "The signs point to...",
      "My intuition tells me...",
      "The unseen forces suggest...",
      "Beyond the veil lies...",
    ],
    noble: [
      "On my honor...",
      "I pledge to you...",
      "By my sword...",
      "I give you my word...",
      "As is my duty...",
      "I stand firm in my belief that...",
      "I shall not falter in...",
      "My oath binds me to...",
    ],
    vagabond: [
      "In my travels...",
      "I've seen enough to know...",
      "The road has taught me...",
      "Take it from someone who's been around...",
      "I've weathered worse storms than this...",
      "Every town has its secrets...",
      "The horizon always calls...",
      "Home is wherever I rest my head...",
    ],
  };

  // Define humor types
  const humorTypes = [
    "dark humor",
    "absurd humor",
    "satirical humor",
    "self-deprecating humor",
    "witty wordplay",
    "dry humor",
    "physical comedy",
    "observational humor",
    "deadpan delivery",
    "slapstick",
    "gallows humor",
    "highbrow references",
    "lowbrow jokes",
    "puns and dad jokes",
    "no sense of humor",
  ];

  // Select tone based on traits
  let preferredTone: string;

  if (traits.neuroticism > 7 && traits.extraversion < 4) {
    preferredTone = "pessimistic";
  } else if (traits.agreeability > 7 && traits.empathy > 7) {
    preferredTone = "nurturing";
  } else if (traits.openness > 7 && traits.conscientiousness > 7) {
    preferredTone = "analytical";
  } else if (traits.confidence > 7 && traits.aggression > 7) {
    preferredTone = "commanding";
  } else if (traits.chivalry > 7) {
    preferredTone = "formal";
  } else if (traits.vagabond > 7) {
    preferredTone = "casual";
  } else if (traits.evil > 7) {
    preferredTone = "sarcastic";
  } else if (traits.good > 7) {
    preferredTone = "optimistic";
  } else {
    // If no strong trait patterns, select randomly
    preferredTone = getRandomElement(tones, seed);
  }

  // Select expressions based on traits
  let expressionType: string;

  if (traits.aggression > 7) {
    expressionType = "aggressive";
  } else if (traits.agreeability > 7) {
    expressionType = "friendly";
  } else if (traits.conscientiousness > 7 && traits.openness > 6) {
    expressionType = "intellectual";
  } else if (traits.openness > 7 && traits.neuroticism > 6) {
    expressionType = "mystical";
  } else if (traits.chivalry > 7) {
    expressionType = "noble";
  } else if (traits.vagabond > 7) {
    expressionType = "vagabond";
  } else if (traits.extraversion > 7) {
    expressionType = "casual";
  } else {
    expressionType = "formal";
  }

  // Select 2-4 common expressions
  const numExpressions = getRandomInt(2, 4, seed);
  const availableExpressions =
    expressionsByType[expressionType] || expressionsByType.casual;
  const commonExpressions: string[] = [];

  for (let i = 0; i < numExpressions; i++) {
    const expression = getRandomElement(availableExpressions, seed);
    if (!commonExpressions.includes(expression)) {
      commonExpressions.push(expression);
    }
  }

  // Select humor type based on traits
  let humorType: string;

  if (traits.evil > 7 && traits.empathy < 4) {
    humorType = "dark humor";
  } else if (traits.openness > 7 && traits.neuroticism > 6) {
    humorType = "absurd humor";
  } else if (traits.openness > 7 && traits.conscientiousness > 6) {
    humorType = "witty wordplay";
  } else if (traits.neuroticism > 7 && traits.confidence < 4) {
    humorType = "self-deprecating humor";
  } else if (traits.agreeability > 7 && traits.extraversion > 6) {
    humorType = "observational humor";
  } else if (traits.conscientiousness > 8 && traits.openness < 4) {
    humorType = "no sense of humor";
  } else if (traits.impulsivity > 7) {
    humorType = "slapstick";
  } else if (traits.chivalry > 7 && traits.openness > 6) {
    humorType = "highbrow references";
  } else {
    humorType = getRandomElement(humorTypes, seed);
  }

  return {
    preferredTone,
    commonExpressions,
    humorType,
  };
}

// Special predefined characters
const specialCharacters: Character[] = [
  // The user will need to define these 4 special characters
  // Each has a 3% chance of appearing
  // Character 1
  {} as Character, // apix
  // Character 2
  {} as Character, // elisa
  // Character 3
  {} as Character, // jefferson
  // Character 4
  {} as Character, // jeff
];

export function generateCharacter({ seed }: { seed: number }): Character {
  // Check if we should return a special character (12% chance total, 3% for each)
  const specialCharacterRoll = ((seed * 9301 + 49297) % 233280) % 100;

  // // If roll is less than 12, return one of the special characters
  if (specialCharacterRoll < 12) {
    // Determine which special character to return (0-3)
    const specialCharacterIndex = Math.floor(specialCharacterRoll / 3);
    return specialCharacters[specialCharacterIndex];
  }

  // Otherwise, generate a random character as before
  const traits = {
    aggression: generateTraitValue(seed),
    agreeability: generateTraitValue(seed),
    openness: generateTraitValue(seed),
    conscientiousness: generateTraitValue(seed),
    extraversion: generateTraitValue(seed),
    neuroticism: generateTraitValue(seed),
    empathy: generateTraitValue(seed),
    confidence: generateTraitValue(seed),
    adaptability: generateTraitValue(seed),
    impulsivity: generateTraitValue(seed),
    evil: generateTraitValue(seed),
    good: generateTraitValue(seed),
    chivalry: generateTraitValue(seed),
    vagabond: generateTraitValue(seed),
  };

  const motivation = generateMotivation(traits, seed);
  const communicationStyle = generateCommunicationStyle(traits, seed);

  return {
    id: generateId(seed),
    name: generateName(traits, seed),
    traits,
    motivation,
    communicationStyle,
    speechExamples: generateSpeechExamples(seed, traits, motivation),
  };
}

export function generateCharacters(count: number): Character[] {
  const characters: Character[] = [];
  for (let i = 0; i < count; i++) {
    characters.push(generateCharacter({ seed: i }));
  }
  return characters;
}
