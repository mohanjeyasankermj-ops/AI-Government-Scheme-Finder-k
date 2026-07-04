import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = 3000;

// Middleware for parsing JSON
app.use(express.json());

// Initialize Gemini SDK lazily to prevent crashing on startup if the API key is not yet set
let aiInstance: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!aiInstance) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("WARNING: GEMINI_API_KEY is not defined in the environment. Gemini integrations will fail.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: apiKey || "MOCK_KEY",
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// ----------------------------------------------------
// CURATED SCHEMES DATABASE
// ----------------------------------------------------
const CuratedSchemes = [
  {
    id: "tn-pudhumai-penn",
    name: "Moovalur Ramamirtham Ammaiyar Higher Education Assurance Scheme (Pudhumai Penn)",
    nameTamil: "புதுமைப் பெண் திட்டம் (மூவலூர் ராமாமிர்தம் அம்மையார் உயர்கல்வி உறுதித் திட்டம்)",
    ministry: "Social Welfare and Women Empowerment Department, Tamil Nadu",
    objective: "Provides financial assistance to girl students who studied in Government schools from 6th to 12th standard, to pursue higher education.",
    benefits: "Monthly financial assistance of ₹1,000 directly deposited to the bank account till the completion of the UG/Diploma/ITI course.",
    eligibilityCriteria: "Girl students residing in Tamil Nadu, studied in TN Government Schools from 6th to 12th standard, enrolled in any recognized UG, diploma, or ITI course.",
    documents: ["Aadhaar Card", "School Transfer Certificate (TC)", "10th and 12th Marksheets", "Government School Study Certificate", "Bank Passbook with IFS Code"],
    howToApply: "Apply online through the Pudhumai Penn Portal (pudhumaipenn.tn.gov.in) with the help of the college nodal officer.",
    category: "State"
  },
  {
    id: "tn-magalir-urimai",
    name: "Kalaignar Magalir Urimai Thogai Thittam",
    nameTamil: "கலைஞர் மகளிர் உரிமைத் தொகை திட்டம்",
    ministry: "Revenue and Disaster Management Department, Tamil Nadu",
    objective: "To recognize the unpaid labor of women and provide financial autonomy to female heads of eligible households.",
    benefits: "Monthly assistance of ₹1,000 sent directly to the female head of the family's bank account.",
    eligibilityCriteria: "Female head of household, Tamil Nadu resident, age above 21, annual family income below ₹2.5 Lakhs, owning less than 5 acres of dry land / 2.5 acres of wet land, annual electricity consumption below 3600 units.",
    documents: ["Aadhaar Card", "Ration Card (Smart Card)", "Income Certificate (Self-Declaration)", "Electricity Bill (for verification)", "Bank Account Details"],
    howToApply: "Register at designated special camps held at local ration shops, or apply online via the dedicated government portal when open.",
    category: "State"
  },
  {
    id: "pm-kisan",
    name: "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
    nameTamil: "பிரதான் மந்திரி கிசான் சம்மான் நிதி (விவசாயிகள் உதவித் திட்டம்)",
    ministry: "Ministry of Agriculture and Farmers Welfare, India",
    objective: "To supplement the financial needs of land-holding farmers in procuring inputs and ensuring proper crop health.",
    benefits: "₹6,000 per year in three equal installments of ₹2,000 directly to bank accounts.",
    eligibilityCriteria: "Small and marginal farmer families who own cultivable land (subject to certain exclusion criteria like institutional landholders, high income tax payers, professionals).",
    documents: ["Aadhaar Card", "Land Ownership Documents (Patta/Chitta)", "Bank Account Details", "Mobile Number linked with Aadhaar"],
    howToApply: "Self-register through the PM-Kisan Portal (pmkisan.gov.in) under 'Farmers Corner' or visit the nearest Common Service Centre (CSC) / Agricultural Officer.",
    category: "Central"
  },
  {
    id: "pm-jay",
    name: "Ayushman Bharat - Pradhan Mantri Jan Arogya Yojana (PM-JAY)",
    nameTamil: "ஆயுஷ்மான் பாரத் - பிரதம மந்திரி ஜன் ஆரோக்கிய யோஜனா (இலவச மருத்துவ காப்பீடு)",
    ministry: "Ministry of Health and Family Welfare, India",
    objective: "To provide free secondary and tertiary healthcare covers to the bottom 40% poor and vulnerable population.",
    benefits: "Cashless health insurance cover of up to ₹5,000,000 (5 Lakhs) per family per year for secondary and tertiary hospitalization.",
    eligibilityCriteria: "Families identified as poor or vulnerable in the Socio-Economic Caste Census (SECC) data. Generally includes landless, low-income, manual laborers.",
    documents: ["Aadhaar Card / Ration Card", "PM-JAY E-Card / Letter", "Income or Caste Certificate"],
    howToApply: "Check eligibility on the PM-JAY website (pmjay.gov.in). If eligible, visit any empanelled public or private hospital and contact the 'Ayushman Mitra' desk to get your Golden Card.",
    category: "Central"
  },
  {
    id: "tn-marriage-assistance",
    name: "Moovalur Ramamirtham Ammaiyar Marriage Assistance Scheme / TN Marriage Scheme",
    nameTamil: "திருமண உதவித் திட்டம் (மூவலூர் ராமாமிர்தம் அம்மையார்)",
    ministry: "Social Welfare and Women Empowerment Department, Tamil Nadu",
    objective: "Help poor parents with financial assistance and gold for their daughters' marriages, promoting female education.",
    benefits: "Scheme I: ₹25,000 and an 8g gold coin (for 10th pass girls). Scheme II: ₹50,000 and an 8g gold coin (for degree/diploma holders).",
    eligibilityCriteria: "Resident of Tamil Nadu, annual income under ₹72,000, girl's minimum age of 18, bridegroom's minimum age of 21.",
    documents: ["Aadhaar Card", "Income Certificate", "10th Marksheet or Degree/Diploma Certificate", "Marriage Invitation", "Community Certificate", "Bank Passbook"],
    howToApply: "Submit the physical application form with required documents to the Block Development Officer (BDO) or Social Welfare Extension Officer, or apply online via e-Sevai.",
    category: "State"
  },
  {
    id: "pm-mudra",
    name: "Pradhan Mantri MUDRA Yojana (PMMY)",
    nameTamil: "பிரதான் மந்திரி முத்ரா கடன் திட்டம்",
    ministry: "Ministry of Finance, India",
    objective: "To provide funding to non-corporate, non-farm small/micro enterprises.",
    benefits: "Collateral-free loans in three categories: Shishu (up to ₹50,000), Kishor (₹50,000 to ₹5 Lakhs), and Tarun (₹5 Lakhs to ₹10 Lakhs).",
    eligibilityCriteria: "Any Indian citizen who has a business plan for a non-farm sector income-generating activity, such as manufacturing, processing, trading, or service sector.",
    documents: ["Aadhaar Card / Voter ID", "Proof of Business Address", "Quotations / Machinery Details", "Business Plan Proposal", "Caste Certificate (if applicable)"],
    howToApply: "Apply directly online via the Udyam Mitra portal (udyamimitra.in) or visit any commercial bank, Regional Rural Bank (RRB), or micro-finance institution.",
    category: "Central"
  }
];

// ----------------------------------------------------
// API ENDPOINT: HEALTH CHECK
// ----------------------------------------------------
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// ----------------------------------------------------
// API ENDPOINT: SEARCH SCHEMES (LIVE WITH GOOGLE SEARCH GROUNDING)
// ----------------------------------------------------
app.post("/api/schemes/search", async (req, res) => {
  try {
    const { query, language = "en" } = req.body;
    if (!query) {
      return res.status(400).json({ error: "Search query is required" });
    }

    const ai = getGeminiClient();
    
    // Construct prompt that guides Gemini to search the web for actual live Indian government schemes
    const prompt = `Search the web and find the latest, active government schemes in India (specifically focusing on Central Government or Tamil Nadu State schemes if requested or relevant) related to the following topic: "${query}".
    
    Provide your output strictly in JSON format as an array of scheme objects.
    Each scheme object MUST have these properties:
    - id: a unique, slug-style string (e.g., "tn-student-scheme")
    - name: Name of the scheme in English
    - nameTamil: Name of the scheme in Tamil (approximate or official translation)
    - ministry: Name of the ministry or department in English
    - objective: Clean summary of the scheme's main objective (1-2 sentences)
    - benefits: Specific financial or other benefits offered
    - eligibilityCriteria: General eligibility conditions (age, income, residency, etc.)
    - documents: Array of strings representing required documents
    - howToApply: Step-by-step application instructions
    - sourceUrl: Reference link or official website URL where citizens can apply
    - category: Either "Central" or "State"
    
    Translate or summarize the descriptions in simple language. If language is 'ta', please ensure the text values (objective, benefits, howToApply) are translated/provided in clear Tamil, otherwise in English, but keep 'nameTamil' populated in all cases.
    Ensure the JSON is perfectly valid. Do not wrap in markdown \`\`\`json blocks in your raw text response if possible, or ensure it is clean.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              nameTamil: { type: Type.STRING },
              ministry: { type: Type.STRING },
              objective: { type: Type.STRING },
              benefits: { type: Type.STRING },
              eligibilityCriteria: { type: Type.STRING },
              documents: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              howToApply: { type: Type.STRING },
              sourceUrl: { type: Type.STRING },
              category: { type: Type.STRING }
            },
            required: ["id", "name", "nameTamil", "ministry", "objective", "benefits", "eligibilityCriteria", "documents", "howToApply", "category"]
          }
        }
      }
    });

    const resultText = response.text || "[]";
    const parsedSchemes = JSON.parse(resultText);

    res.json({ schemes: parsedSchemes, grounded: true });
  } catch (error: any) {
    console.error("Error searching live schemes:", error);
    // Fallback: search local curated database
    const queryLower = (req.body.query || "").toLowerCase();
    const filteredLocal = CuratedSchemes.filter(s => 
      s.name.toLowerCase().includes(queryLower) || 
      s.nameTamil.toLowerCase().includes(queryLower) ||
      s.objective.toLowerCase().includes(queryLower) ||
      s.ministry.toLowerCase().includes(queryLower)
    );
    res.json({ schemes: filteredLocal, grounded: false, note: "Search completed using local fallback due to API status." });
  }
});

// ----------------------------------------------------
// API ENDPOINT: ANALYZE PROFILE ELIGIBILITY
// ----------------------------------------------------
app.post("/api/schemes/analyze", async (req, res) => {
  try {
    const profile = req.body.profile;
    const preferredLanguage = req.body.language || "en"; // "en" or "ta"

    if (!profile) {
      return res.status(400).json({ error: "User profile is required" });
    }

    const ai = getGeminiClient();

    // Serialize profile safely
    const profileStr = JSON.stringify(profile, null, 2);

    const prompt = `You are an expert government scheme matchmaker. Review the following citizen profile:
    ${profileStr}
    
    And evaluate which Indian government schemes (Central Government or state of ${profile.state || "Tamil Nadu"}) they are highly likely to be eligible for.
    Your recommendations MUST include:
    1. Curated matches from standard schemes like Pudhumai Penn, Kalaignar Magalir Urimai Thogai, PM-Kisan, PM-JAY, Mudra Yojana, etc. if they fit this profile.
    2. Other real, active Indian government schemes (from Central or State) that fit their specific age, occupation, gender, state, and income.
    
    Return your analysis strictly as a JSON array of scheme objects.
    Each recommended scheme object MUST contain:
    - id: unique identifier string
    - name: Name of the scheme in English
    - nameTamil: Name of the scheme in Tamil
    - ministry: Ministry or department (e.g., "Ministry of Agriculture")
    - category: "Central" or "State"
    - objective: What is the scheme's main purpose (keep it simple)
    - benefits: Exact support details (e.g., financial help, loans, scholarships)
    - eligibilityWhy: A personal explanation detailing exactly why THIS user is eligible (e.g., "As a girl student from Tamil Nadu studying in UG, you qualify for...")
    - documents: Array of strings representing required documents
    - howToApply: Simple step-by-step application instructions
    
    Provide the descriptive fields (objective, benefits, eligibilityWhy, howToApply) in simple ${preferredLanguage === "ta" ? "Tamil (தமிழ்)" : "English"}, so the citizen can understand them easily. For English, keep it highly readable. For Tamil, use warm, respectful and clear Tamil phrasing.
    Recommend between 3 to 6 schemes that best fit this profile. Do not recommend schemes they clearly do not qualify for.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              name: { type: Type.STRING },
              nameTamil: { type: Type.STRING },
              ministry: { type: Type.STRING },
              category: { type: Type.STRING },
              objective: { type: Type.STRING },
              benefits: { type: Type.STRING },
              eligibilityWhy: { type: Type.STRING },
              documents: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              howToApply: { type: Type.STRING }
            },
            required: ["id", "name", "nameTamil", "ministry", "category", "objective", "benefits", "eligibilityWhy", "documents", "howToApply"]
          }
        }
      }
    });

    const schemesList = JSON.parse(response.text || "[]");
    res.json({ schemes: schemesList });
  } catch (error: any) {
    console.error("Error analyzing eligibility:", error);
    // Local fallback recommendations based on simple criteria
    const { age = 25, gender = "Female", state = "Tamil Nadu", occupation = "Student", annualIncome = 150000 } = req.body.profile || {};
    const fallbackMatches = [];

    if (state === "Tamil Nadu" && gender === "Female" && occupation === "Student" && age >= 17 && age <= 25) {
      fallbackMatches.push(CuratedSchemes[0]); // Pudhumai Penn
    }
    if (state === "Tamil Nadu" && gender === "Female" && age >= 21 && annualIncome <= 250000) {
      fallbackMatches.push(CuratedSchemes[1]); // Magalir Urimai
    }
    if (occupation === "Farmer" || occupation === "Agriculture") {
      fallbackMatches.push(CuratedSchemes[2]); // PM Kisan
    }
    if (annualIncome <= 250000) {
      fallbackMatches.push(CuratedSchemes[3]); // PM-JAY
    }
    fallbackMatches.push(CuratedSchemes[5]); // Mudra Loan (Business)

    const mappedFallback = fallbackMatches.map(s => ({
      ...s,
      eligibilityWhy: req.body.language === "ta" 
        ? `உங்கள் சுயவிவரத்தின்படி (வயது: ${age}, தொழில்: ${occupation}, வருமானம்: ₹${annualIncome}), நீங்கள் இந்தத் திட்டத்திற்கு தகுதி பெற வாய்ப்புள்ளது.`
        : `Based on your profile (Age: ${age}, Occupation: ${occupation}, Income: ₹${annualIncome}), you are highly likely to be eligible for this scheme.`
    }));

    res.json({ schemes: mappedFallback, fallback: true });
  }
});

// ----------------------------------------------------
// API ENDPOINT: UPLOAD & ANALYZE NEW SCHEME DOCUMENT
// ----------------------------------------------------
app.post("/api/schemes/upload-analysis", async (req, res) => {
  try {
    const { schemeContent, userProfile, language = "en" } = req.body;
    if (!schemeContent) {
      return res.status(400).json({ error: "Scheme content is required" });
    }

    const ai = getGeminiClient();
    const profileText = userProfile ? JSON.stringify(userProfile, null, 2) : "None provided";

    const prompt = `You are a high-level government policy analyst. Analyze the following newly-published scheme notification or document text:
    --- SCHEME DOCUMENT CONTENT ---
    ${schemeContent}
    -------------------------------
    
    And evaluate it thoroughly. Also check if a citizen with the following profile matches its conditions:
    --- CITIZEN PROFILE ---
    ${profileText}
    -----------------------
    
    Return a structured JSON response containing:
    1. schemeName: Name in English
    2. schemeNameTamil: Name in Tamil
    3. ministry: Publishing government department
    4. mainObjective: Core objective of this newly uploaded scheme
    5. keyBenefits: Summary of all direct and indirect benefits (monetary, materials, training, etc.)
    6. eligibilityCriteriaSummary: Full list of criteria parsed from the text
    7. citizenEligibilityStatus: "Eligible" or "Not Eligible" or "Undetermined" (Explain if profile was provided)
    8. citizenEligibilityExplanation: A detailed personal explanation of why they are or are not eligible, citing specific clauses in the document.
    9. stepsToApply: Actionable steps to apply as found in the document
    10. criticalDates: Deadlines, start dates, or timeline updates mentioned.
    
    Provide all explanations, summaries, and action steps in simple, citizen-friendly ${language === "ta" ? "Tamil (தமிழ்)" : "English"}. Ensure the response is perfectly formatted JSON.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            schemeName: { type: Type.STRING },
            schemeNameTamil: { type: Type.STRING },
            ministry: { type: Type.STRING },
            mainObjective: { type: Type.STRING },
            keyBenefits: { type: Type.STRING },
            eligibilityCriteriaSummary: { type: Type.STRING },
            citizenEligibilityStatus: { type: Type.STRING },
            citizenEligibilityExplanation: { type: Type.STRING },
            stepsToApply: { type: Type.STRING },
            criticalDates: { type: Type.STRING }
          },
          required: ["schemeName", "schemeNameTamil", "ministry", "mainObjective", "keyBenefits", "eligibilityCriteriaSummary", "citizenEligibilityStatus", "citizenEligibilityExplanation", "stepsToApply", "criticalDates"]
        }
      }
    });

    const analysisResult = JSON.parse(response.text || "{}");
    res.json(analysisResult);
  } catch (error: any) {
    console.error("Error analyzing uploaded scheme:", error);
    res.status(500).json({ error: "Failed to analyze scheme text. Please check the content and try again." });
  }
});

// ----------------------------------------------------
// API ENDPOINT: SCHEME CHATBOT ASSISTANT
// ----------------------------------------------------
app.post("/api/schemes/chat", async (req, res) => {
  try {
    const { messages, userProfile, currentScheme, language = "en" } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Conversation messages are required" });
    }

    const ai = getGeminiClient();

    // Prepare system instruction to anchor the chatbot's identity and state
    let systemInstruction = `You are 'Sevai AI', a friendly and compassionate Government Scheme Assistant. 
    Your goal is to answer citizen questions about various Indian government schemes (Central and State, especially Tamil Nadu) with extreme clarity, patience, and kindness.
    
    Keep answers humble, direct, and completely free of technical jargon.
    Preferred response language: ${language === "ta" ? "Tamil (தமிழ்)" : "English (ஆங்கிலம்)"}. 
    When answering in Tamil, write in highly respectful colloquial or standard Tamil script (e.g., using "நீங்கள்", "உங்களுக்கு" with helpful guidance).
    
    If the user has a profile, here is their profile context:
    ${userProfile ? JSON.stringify(userProfile, null, 2) : "No profile entered yet."}
    
    If they are viewing a specific scheme, here is the scheme context:
    ${currentScheme ? JSON.stringify(currentScheme, null, 2) : "No specific scheme is currently focused."}
    
    When appropriate, feel free to use Google Search to verify scheme deadlines or check if any new schemes are announced!
    Keep your response concise, readable, and structured using bold text or bullet points where necessary.`;

    // Map history to Gemini API expected format
    // Filter last 10 messages for token efficiency
    const recentMessages = messages.slice(-10);
    const contents = recentMessages.map((m: any) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }]
    }));

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        tools: [{ googleSearch: {} }] // Enable search grounding for chatbot to fetch live details!
      }
    });

    res.json({ response: response.text });
  } catch (error: any) {
    console.error("Error in chatbot assistant:", error);
    res.status(500).json({ 
      response: req.body.language === "ta" 
        ? "மன்னிக்கவும், என்னால் இப்போது பதிலளிக்க முடியவில்லை. தயவுசெய்து சிறிது நேரம் கழித்து மீண்டும் முயற்சிக்கவும்." 
        : "I am sorry, but I encountered an error connecting to the AI helper. Please try again in a moment." 
    });
  }
});

// ----------------------------------------------------
// VITE DEV SERVER & PRODUCTION ROUTING
// ----------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    // Mount Vite development middlewares
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    console.log("Vite development server middleware loaded.");
  } else {
    // Serve static files from the dist folder in production
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    console.log("Production static files router loaded.");
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`AI Government Scheme Finder server running on port ${PORT}`);
  });
}

startServer();
