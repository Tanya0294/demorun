import google.generativeai as genai
import os

# Setup Gemini API Key
genai.configure(api_key=os.getenv("AIzaSyCD6OmPfLk4b6vZxYvLVSJ1AdkC2Hay2CA"))

model = genai.GenerativeModel('gemini-pro')

def generate_quiz(topic: str, num_questions: int) -> list:
    prompt = f"""
    You are a quiz generator bot.
    Generate {num_questions} multiple choice questions about "{topic}".
    Format each question like:
    {{
      "question": "Your question text?",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "answer": "Correct Option"
    }}
    Return JSON array only. No extra text.
    """
    
    response = model.generate_content(prompt)
    quiz_data = response.text

    import json
    try:
        return json.loads(quiz_data)
    except json.JSONDecodeError:
        # If something goes wrong, return an empty list
        return []

