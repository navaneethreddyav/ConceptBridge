const { OpenAI } = require('openai');
const { queryOllama } = require('./ollama');

// Initialize OpenAI client
const getOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey === 'your_openai_api_key_here') {
    return null;
  }
  return new OpenAI({ apiKey });
};

/**
 * Helper to determine active AI provider.
 * Returns 'openai', 'ollama', or 'mock'.
 */
function getActiveProvider() {
  const provider = (process.env.AI_PROVIDER || 'openai').toLowerCase();
  
  if (provider === 'ollama') {
    return 'ollama';
  }
  
  const openai = getOpenAIClient();
  if (openai) {
    return 'openai';
  }
  
  return 'mock';
}

/**
 * Extracts 5 to 20 key technical concepts from the text.
 * 
 * @param {string} text The extracted text from the PDF
 * @returns {Promise<string[]>} List of concepts
 */
async function extractConcepts(text) {
  const provider = getActiveProvider();
  
  if (provider === 'mock') {
    return getMockConcepts(text);
  }

  const prompt = `Extract key academic and technical concepts from the following text:\n\n${text.substring(0, 15000)}`;
  const systemPrompt = 'You are an educational assistant that extracts important technical, scientific, or academic concepts from the provided text. Return a JSON object with a single key "concepts" containing an array of 5 to 20 important technical concepts, sorted by relevance. Ignore duplicates, common words, and generic terms.';

  if (provider === 'ollama') {
    try {
      const response = await queryOllama(prompt, systemPrompt);
      if (response && Array.isArray(response.concepts)) {
        return response.concepts;
      }
      return getMockConcepts(text);
    } catch (ollamaError) {
      console.warn('Ollama concept extraction failed, falling back to mock:', ollamaError.message);
      return getMockConcepts(text);
    }
  }

  // Remote OpenAI
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const result = JSON.parse(response.choices[0].message.content);
    if (result && Array.isArray(result.concepts)) {
      return result.concepts;
    }
    return getMockConcepts(text);
  } catch (error) {
    console.error('OpenAI Concept Extraction failed, falling back to mock concepts:', error.message);
    return getMockConcepts(text);
  }
}

/**
 * Generates explanations and translations for a concept.
 * 
 * @param {string} concept The technical concept name
 * @param {string} language The target translation language
 * @returns {Promise<{concept: string, nativeTranslation: string, simpleExplanation: string, nativeExplanation: string, realWorldExample: string, keyTakeaways: string[]}>}
 */
async function explainConcept(concept, language = 'Telugu') {
  const provider = getActiveProvider();

  if (provider === 'mock') {
    return getMockExplanation(concept, language);
  }

  const prompt = `Explain the concept: "${concept}"`;
  const systemPrompt = `You are an educational tutor helping rural and regional-language students in India understand complex terms.
Your goal is to explain the requested concept in simple, jargon-free English and translate it accurately and naturally into the target language: "${language}".

For the translation and explanation, do not provide literal word-for-word translations. Use natural, conversational, student-friendly phrasing (written in the correct script for "${language}") that conveys the core idea clearly.

Return a JSON object with the following fields:
- "concept": (string) The name of the concept in English
- "nativeTranslation": (string) The translation or transliteration of the concept name in the "${language}" script (e.g. "మెషిన్ లెర్నింగ్" for Telugu, "मशीन लर्निंग" for Hindi)
- "simpleExplanation": (string) A beginner-friendly explanation of the concept in English. Avoid technical jargon. Explain it to a 12-year-old. Maximum 150 words.
- "nativeExplanation": (string) The explanation of the concept in natural, student-friendly phrasing in the "${language}" script.
- "realWorldExample": (string) A single, relatable real-world example explaining this concept.
- "keyTakeaways": (array of strings) A list of 2 to 4 key takeaways or bullet points summarizing the concept for the student.`;

  if (provider === 'ollama') {
    try {
      const response = await queryOllama(prompt, systemPrompt);
      return {
        concept: response.concept || concept,
        nativeTranslation: response.nativeTranslation || response.teluguTranslation || '',
        simpleExplanation: response.simpleExplanation || '',
        nativeExplanation: response.nativeExplanation || response.teluguExplanation || '',
        realWorldExample: response.realWorldExample || '',
        keyTakeaways: response.keyTakeaways || []
      };
    } catch (ollamaError) {
      console.warn('Ollama explanation failed, falling back to mock:', ollamaError.message);
      return getMockExplanation(concept, language);
    }
  }

  // OpenAI
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return {
      concept: parsed.concept || concept,
      nativeTranslation: parsed.nativeTranslation || parsed.teluguTranslation || '',
      simpleExplanation: parsed.simpleExplanation || '',
      nativeExplanation: parsed.nativeExplanation || parsed.teluguExplanation || '',
      realWorldExample: parsed.realWorldExample || '',
      keyTakeaways: parsed.keyTakeaways || []
    };
  } catch (error) {
    console.error('OpenAI Explanation failed, falling back to mock explanation:', error.message);
    return getMockExplanation(concept, language);
  }
}

/**
 * Explains custom selection block.
 * 
 * @param {string} text The user selected highlight text
 * @param {string} language Target translation language
 * @returns {Promise<{concept: string, nativeTranslation: string, simpleExplanation: string, nativeExplanation: string, realWorldExample: string, keyTakeaways: string[]}>}
 */
async function explainSelection(text, language = 'Telugu') {
  const provider = getActiveProvider();

  if (provider === 'mock') {
    return getMockSelectionExplanation(text, language);
  }

  const prompt = `Explain the following text selection:\n\n"${text}"`;
  const systemPrompt = `You are an educational tutor helping rural and regional-language students in India understand academic passages.
Your goal is to take the selected text and explain it in simple, jargon-free English and translate/explain it naturally into the target language: "${language}".

For the translation and explanation, do not provide literal word-for-word translations. Use natural, conversational, student-friendly phrasing (written in the correct script for "${language}") that conveys the core idea clearly.

Return a JSON object with the following fields:
- "concept": (string) A concise title or short label identifying the subject of this selection in English (e.g. "Deep Learning Layers")
- "nativeTranslation": (string) The translation or transliteration of this short label in the "${language}" script
- "simpleExplanation": (string) A beginner-friendly explanation of the selected text in English. Avoid technical jargon. Explain it to a 12-year-old. Maximum 150 words.
- "nativeExplanation": (string) The explanation of the text in natural, student-friendly phrasing in the "${language}" script.
- "realWorldExample": (string) A single, relatable real-world analogy or scenario explaining this text.
- "keyTakeaways": (array of strings) A list of 2 to 4 key takeaways or bullet points summarizing the most important details a student should remember from the selection.`;

  if (provider === 'ollama') {
    try {
      const response = await queryOllama(prompt, systemPrompt);
      return {
        concept: response.concept || 'Text Highlight',
        nativeTranslation: response.nativeTranslation || response.teluguTranslation || '',
        simpleExplanation: response.simpleExplanation || '',
        nativeExplanation: response.nativeExplanation || response.teluguExplanation || '',
        realWorldExample: response.realWorldExample || response.analogy || '',
        keyTakeaways: response.keyTakeaways || []
      };
    } catch (ollamaError) {
      console.warn('Ollama selection explanation failed, falling back to mock:', ollamaError.message);
      return getMockSelectionExplanation(text, language);
    }
  }

  // OpenAI
  try {
    const openai = getOpenAIClient();
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      temperature: 0.5,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
      ]
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return {
      concept: parsed.concept || 'Text Highlight',
      nativeTranslation: parsed.nativeTranslation || parsed.teluguTranslation || '',
      simpleExplanation: parsed.simpleExplanation || '',
      nativeExplanation: parsed.nativeExplanation || parsed.teluguExplanation || '',
      realWorldExample: parsed.realWorldExample || parsed.analogy || '',
      keyTakeaways: parsed.keyTakeaways || []
    };
  } catch (error) {
    console.error('OpenAI Selection Explanation failed, falling back to mock selection:', error.message);
    return getMockSelectionExplanation(text, language);
  }
}

// --- MOCK FALLBACKS FOR DEMO / OFFLINE TESTING ---

function getMockConcepts(text) {
  const defaultConcepts = [
    'Machine Learning',
    'Artificial Intelligence',
    'Neural Networks',
    'Supervised Learning',
    'Algorithm',
    'Data Science',
    'Deep Learning',
    'Regression Analysis'
  ];

  if (!text || text.trim().length === 0) return defaultConcepts;

  const found = [];
  const lowerText = text.toLowerCase();
  
  const keywords = {
    'machine learning': 'Machine Learning',
    'artificial intelligence': 'Artificial Intelligence',
    'neural network': 'Neural Networks',
    'deep learning': 'Deep Learning',
    'database': 'Database Management System',
    'algorithm': 'Algorithm',
    'data structures': 'Data Structures',
    'operating system': 'Operating System',
    'photosynthesis': 'Photosynthesis',
    'cellular respiration': 'Cellular Respiration',
    'gravity': 'Gravity',
    'thermodynamics': 'Thermodynamics',
    'calculus': 'Calculus',
    'statistics': 'Statistics',
    'data science': 'Data Science'
  };

  for (const [key, value] of Object.entries(keywords)) {
    if (lowerText.includes(key)) {
      found.push(value);
    }
  }

  return found.length >= 3 ? [...new Set(found)] : defaultConcepts;
}

function getMockExplanation(concept, language) {
  const isHindi = language.toLowerCase() === 'hindi';
  
  const teluguMocks = {
    'Machine Learning': {
      concept: 'Machine Learning',
      nativeTranslation: 'మెషిన్ లెర్నింగ్',
      simpleExplanation: 'Machine Learning is a method that allows computers to learn patterns from data and make predictions without being explicitly programmed.',
      nativeExplanation: 'డేటా ద్వారా కంప్యూటర్లు నేర్చుకునే విధానాన్ని మెషిన్ లెర్నింగ్ అంటారు. కంప్యూటర్లకు ప్రత్యేకంగా కోడింగ్ రాయకుండా, అవి మునుపటి సమాచారం ఆధారంగా స్వయంగా విషయాలు నేర్చుకుంటాయి.',
      realWorldExample: 'Netflix recommending movies based on what you watched earlier.',
      keyTakeaways: ['Computers learn from historical patterns', 'Eliminates direct hardcoded scripts', 'Powers prediction models']
    },
    'Artificial Intelligence': {
      concept: 'Artificial Intelligence',
      nativeTranslation: 'కృత్రిమ మేధస్సు',
      simpleExplanation: 'Artificial Intelligence is the ability of computers or machines to think, learn, and make decisions like humans do.',
      nativeExplanation: 'మనుషుల లాగా ఆలోచించే, నేర్చుకునే మరియు నిర్ణయాలు తీసుకునే కంప్యూటర్ లేదా యంత్రం యొక్క సామర్థ్యాన్ని కృత్రిమ మేధస్సు అంటారు.',
      realWorldExample: 'Siri or Google Assistant understanding your voice commands and answering.',
      keyTakeaways: ['Replicates human-like logic', 'Supports automated learning cycles', 'Powers digital assistants']
    }
  };

  const hindiMocks = {
    'Machine Learning': {
      concept: 'Machine Learning',
      nativeTranslation: 'मशीन लर्निंग',
      simpleExplanation: 'Machine Learning is a method that allows computers to learn patterns from data and make predictions without being explicitly programmed.',
      nativeExplanation: 'मशीन लर्निंग कंप्यूटर को डेटा से पैटर्न सीखने और बिना किसी विशिष्ट कोडिंग के भविष्यवाणियां करने की अनुमति देने की एक विधि है।',
      realWorldExample: 'Netflix recommending movies based on what you watched earlier.',
      keyTakeaways: ['डेटा पैटर्न्स से कंप्यूटर खुद सीखते हैं', 'कोडिंग की ज़रूरत नहीं पड़ती', 'भविष्यवाणी करने में मदद करता है']
    },
    'Artificial Intelligence': {
      concept: 'Artificial Intelligence',
      nativeTranslation: 'कृत्रिम बुद्धिमत्ता (AI)',
      simpleExplanation: 'Artificial Intelligence is the ability of computers or machines to think, learn, and make decisions like humans do.',
      nativeExplanation: 'कृत्रिम बुद्धिमत्ता कंप्यूटर या मशीनों की इंसानों की तरह सोचने, सीखने और निर्णय लेने की क्षमता है।',
      realWorldExample: 'Siri or Google Assistant understanding your voice commands.',
      keyTakeaways: ['मानव बुद्धि की तरह काम करता है', 'तर्क और पैटर्न पर आधारित है', 'स्वचालन में मदद करता है']
    }
  };

  const currentMocks = isHindi ? hindiMocks : teluguMocks;
  const matched = currentMocks[concept] || Object.values(currentMocks).find(m => m.concept.toLowerCase() === concept.toLowerCase());
  
  if (matched) return matched;

  // Generic Mock explanation translated to requested language name
  return {
    concept: concept,
    nativeTranslation: `${concept} (${language} Translation)`,
    simpleExplanation: `This is a simplified educational summary for "${concept}". It refers to a fundamental scientific or academic principle that helps build complex systems.`,
    nativeExplanation: `"${concept}" అనేది ఒక విద్యా సిద్ధాంతం. ఇది విద్యార్థులకు క్లిష్టమైన సాంకేతిక పద్ధతులను మరియు సిద్ధాంతాలను సులభంగా వివరిస్తుంది. (Explanations rendered in ${language})`,
    realWorldExample: `A everyday scenario illustrating the basic properties and functionality of "${concept}".`,
    keyTakeaways: [`Key principle of ${concept}`, 'Essential for student reviews', 'Core building block of the system']
  };
}

function getMockSelectionExplanation(text, language) {
  const isHindi = language.toLowerCase() === 'hindi';
  const cleanText = text.toLowerCase();
  
  if (cleanText.includes('deep learning') || cleanText.includes('layered')) {
    return {
      concept: "Deep Learning Layers",
      nativeTranslation: isHindi ? "डीप लर्निंग लेयर्स (गहन शिक्षण परतें)" : "డీప్ లెర్నింగ్ లేయర్స్ (లోతైన అభ్యసన పొరలు)",
      simpleExplanation: "Deep Learning is a type of Machine Learning that uses multi-layered computer networks (like deep layers of filtering) to learn features from data. The 'deep' refers to the many layers of nodes the data passes through.",
      nativeExplanation: isHindi 
        ? "डीप लर्निंग मशीन लर्निंग का एक हिस्सा है। यह जानकारी से फीचर्स सीखने के लिए मल्टी-लेयर्ड कंप्यूटर नेटवर्क का उपयोग करता है (जैसे कि मस्तिष्क के न्यूरॉन्स काम करते हैं)।"
        : "డీప్ లెర్నింగ్ అనేది మెషిన్ లెర్నింగ్ లో ఒక భాగం. ఇది సమాచారం నుండి ముఖ్యాంశాలను గుర్తించడానికి బహుళ పొరల (layers) కంప్యూటర్ నెట్‌వర్క్‌లను ఉపయోగిస్తుంది.",
      realWorldExample: "A security system recognizing your face by checking lines, then eyes, then shapes, layer by layer.",
      keyTakeaways: [
        "Uses multi-layered artificial networks.",
        "Processes raw data to extract high-level features.",
        "Allows computers to solve complex problems like image recognition."
      ]
    };
  }

  // Generic Mock Selection
  return {
    concept: text.length > 30 ? text.substring(0, 27) + '...' : text,
    nativeTranslation: `పాఠం ముక్క (${language} Translate)`,
    simpleExplanation: `This text explains a technical academic concept. Simply put, it describes a process where variables or entities interact to complete a specific task or build a system.`,
    nativeExplanation: `ఈ వాక్యం ఒక ప్రధాన సిద్ధాंतాన్ని వివరిస్తుంది. దీని గురించి సులభంగా తెలుసుకోవడానికి ఈ అంశాన్ని సేకరించడం జరిగింది. (Rendered in ${language} script)`,
    realWorldExample: `A team of specialists working together on an assembly line to build a complex item.`,
    keyTakeaways: [
      "Highlights a key element in the text.",
      `Provides context in ${language} for easy comprehension.`,
      "Synthesizes academic insights."
    ]
  };
}

module.exports = {
  extractConcepts,
  explainConcept,
  explainSelection
};
