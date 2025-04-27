// Wait for the DOM to be fully loaded
document.addEventListener('DOMContentLoaded',() => {
    // Error handling - check if elements exist before accessing them
    const quizForm = document.querySelector('.quiz-form');
    if (!quizForm) {
      console.error('Quiz form not found. Check your HTML structure.');
      return; // Stop execution if form doesn't exist
    }
    
    // Helper function to safely get elements
    function getElement(selector, fallbackValue = null) {
      const element = document.querySelector(selector);
      if (!element && fallbackValue === null) {
        console.warn(Element "${selector}" not found in the document.);
      }
      return element || fallbackValue;
    }
  
    // Get required elements with fallbacks
    const quizPlaceholder = getElement('#quiz-placeholder');
    const quizQuestionsContainer = getElement('#quiz-questions');
    const toggleAnswersBtn = getElement('#toggle-answers');
    const exportQuizBtn = getElement('#export-quiz');
    
    // Form submission handler with improved error handling
    quizForm.addEventListener('submit', async function (event) {
      event.preventDefault();
      console.log('Form submitted, processing...');
      
      // Show loading state if placeholder exists
      if (quizPlaceholder) {
        quizPlaceholder.classList.remove('hidden');
        quizPlaceholder.innerHTML = '<p>Generating your quiz...</p><div class="loader"></div>';
      }
      
      if (quizQuestionsContainer) {
        quizQuestionsContainer.classList.add('hidden');
      }
  
      try {
        // Safely get user inputs with validation
        const topic = getElement('#topic')?.value?.trim() || 'General Knowledge';
        const questionsInput = getElement('#questions');
        const questionsCount = questionsInput ? parseInt(questionsInput.value) || 10 : 10;
        
        const difficultyInput = getElement('input[name="difficulty"]:checked');
        const difficulty = difficultyInput ? difficultyInput.value : 'medium';
        
        // Get question types with fallback
        let questionTypes = [];
        try {
          const questionTypeInputs = document.querySelectorAll('input[name="question-type"]:checked');
          questionTypes = Array.from(questionTypeInputs).map(input => input.value);
        } catch (e) {
          console.warn('Error getting question types:', e);
          questionTypes = ['multiple-choice']; // Default fallback
        }
        
        // Safely get learning objectives if they exist
        let learningObjectives = [];
        try {
          const tagElements = document.querySelectorAll('.tags-container .tag');
          if (tagElements && tagElements.length > 0) {
            learningObjectives = Array.from(tagElements).map(tag => {
              // Extract text without the "×" close button
              return tag.textContent.replace('×', '').trim();
            });
          }
        } catch (e) {
          console.warn('Error getting learning objectives:', e);
        }
  
        console.log('Preparing request with:', { topic, questionsCount, difficulty, questionTypes, learningObjectives });
  
        // Make API request with error handling
        console.log('Sending request to Gemini API...');
        const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': 'AIzaSyCnGehXMO7wJoCJ4YoOwHUEkqAmsn68IlY', // Your API key
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `Please generate a quiz about "${topic}" with these specifications:
                  - Number of questions: ${questionsCount}
                  - Difficulty level: ${difficulty}
                  - Question types: ${questionTypes.join(', ')}
                  ${learningObjectives.length > 0 ? '- Learning objectives: ' + learningObjectives.join(', ') : ''}
                  
                  Format the response as a JSON array of question objects. Each question should include:
                  - "text": the question text
                  - "options": array of possible answers (4 options)
                  - "correctAnswer": the index number of the correct answer (0 for first option, 1 for second, etc.)
                  - "explanation": brief explanation of why the answer is correct
                  
                  Return ONLY valid JSON without any additional text or formatting.`
              }]
            }),
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 2048,
            }
          })
        });
  
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          console.error('API Error:', errorData);
          throw new Error(API request failed with status ${response.status}: ${errorData.error?.message || 'Unknown error'});
        }
  
        console.log('Response received, processing...');
        const data = await response.json();
        
        // Extract and parse questions with robust error handling
        let questions = [];
        try {
          if (!data?.candidates?.[0]?.content?.parts?.[0]?.text) {
            throw new Error('Invalid API response structure');
          }
          
          const text = data.candidates[0].content.parts[0].text;
          console.log('Raw response:', text);
          
          // Multiple strategies to extract JSON
          let jsonText = '';
          
          // Try to find JSON in code blocks
          const jsonMatch = text.match(/(?:json)?\s*([\s\S]*?)\s*/) || 
                            text.match(/\[\s*\{\s*"[\s\S]\}\s\]/) ||
                            text.match(/\{\s*"questions"\s*:\s*\[\s*\{[\s\S]\}\s\]\s*\}/);
                            
          if (jsonMatch) {
            jsonText = jsonMatch[0].replace(/(?:json)?|/g, '').trim();
          } else {
            // If no code blocks, try to find the largest JSON-like structure
            jsonText = text;
          }
          
          // Clean up any non-JSON text
          jsonText = jsonText.replace(/^[^[{]/, '').replace(/[^}\]]$/, '');
          
          console.log('Extracted JSON text:', jsonText);
          
          // Parse the JSON
          const parsedData = JSON.parse(jsonText);
          
          // Handle different possible JSON structures
          if (Array.isArray(parsedData)) {
            questions = parsedData;
          } else if (parsedData.questions && Array.isArray(parsedData.questions)) {
            questions = parsedData.questions;
          } else {
            // As a last resort, try to build questions from any object properties
            questions = Object.values(parsedData).filter(item => 
              item && typeof item === 'object' && item.text && item.options);
          }
          
          // Validate each question
          questions = questions.map((q, i) => {
            // Ensure each question has required properties
            return {
              text: q.text || Question ${i+1},
              options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
              correctAnswer: q.correctAnswer !== undefined ? q.correctAnswer : 0,
              explanation: q.explanation || 'No explanation provided.'
            };
          });
          
          console.log('Parsed questions:', questions);
          
        } catch (parseError) {
          console.error('Error parsing response:', parseError);
          
          // Fallback: Try to create questions manually from the text
          try {
            const text = data.candidates[0].content.parts[0].text;
            const questionMatches = text.match(/(?:Question \d+|Q\d+)[:.]\s*(.*?)(?=(?:Question \d+|Q\d+)|$)/gs);
            
            if (questionMatches && questionMatches.length > 0) {
              questions = questionMatches.map((q, i) => {
                const questionText = q.match(/(?:Question \d+|Q\d+)[:.]\s*(.*?)(?=\n|$)/)?.[1] || Question ${i+1};
                
                // Try to extract options
                const options = [];
                const optionMatches = q.match(/(?:[A-D][.).]\s*)(.?)(?=\n[A-D][.).]\s|\n(?:Answer|Correct|Explanation)|\n\n|$)/gs);
                if (optionMatches) {
                  optionMatches.forEach(opt => {
                    const cleanOption = opt.replace(/^[A-D][.).]\s*/, '').trim();
                    options.push(cleanOption);
                  });
                }
                
                // If no options found, create generic ones
                if (options.length === 0) {
                  options.push('Option A', 'Option B', 'Option C', 'Option D');
                }
                
                // Try to determine correct answer
                let correctAnswer = 0;
                const correctMatch = q.match(/(?:Answer|Correct)[:.]\s*([A-D])/i);
                if (correctMatch) {
                  const letter = correctMatch[1].toUpperCase();
                  correctAnswer = letter.charCodeAt(0) - 65; // A=0, B=1, etc.
                }
                
                // Try to get explanation
                const explanation = q.match(/(?:Explanation)[:.]\s*(.*?)(?=\n\n|$)/s)?.[1] || 'No explanation provided.';
                
                return { text: questionText, options, correctAnswer, explanation };
              });
            } else {
              throw new Error('Could not extract questions from response');
            }
          } catch (fallbackError) {
            console.error('Fallback parsing failed:', fallbackError);
            throw new Error('Could not parse the quiz data: ' + parseError.message);
          }
        }
  
        if (questions.length === 0) {
          throw new Error('No valid questions generated');
        }
  
        // Render the generated questions
        renderQuiz(questions);
        
      } catch (error) {
        console.error('Error generating quiz:', error);
        if (quizPlaceholder) {
          quizPlaceholder.innerHTML = `
            <p>Unable to generate quiz: ${error.message}</p>
            <p>Please try again with a different topic or check your connection.</p>
            <button class="btn btn-outline" onclick="location.reload()">Try Again</button>
          `;
          quizPlaceholder.classList.remove('hidden');
        }
      }
    });
  
    // Render the generated quiz questions with error handling
    function renderQuiz(questions) {
      if (!quizQuestionsContainer) {
        console.error('Quiz questions container not found');
        return;
      }
      
      if (questions && questions.length > 0) {
        try {
          const questionsHTML = questions.map((question, index) => {
            // Make sure options is an array
            const options = Array.isArray(question.options) ? question.options : [];
            
            const optionsHTML = options.map((option, i) => {
              // Determine if this option is correct
              let isCorrect = false;
              
              if (typeof question.correctAnswer === 'number') {
                isCorrect = i === question.correctAnswer;
              } else if (typeof question.correctAnswer === 'string') {
                // Handle if correctAnswer is option text or letter
                isCorrect = option === question.correctAnswer || 
                            String.fromCharCode(65 + i) === question.correctAnswer.toUpperCase();
              }
              
              return `
                <div class="option ${isCorrect ? 'correct' : ''}">
                  <span class="option-letter">${String.fromCharCode(65 + i)}</span>
                  ${option}
                </div>
              `;
            }).join('');
  
            return `
              <div class="question">
                <h4>Question ${index + 1}: ${question.text}</h4>
                <div class="options">
                  ${optionsHTML}
                </div>
                <div class="explanation hidden">
                  <strong>Explanation:</strong> ${question.explanation || 'No explanation provided.'}
                </div>
              </div>
            `;
          }).join('');
  
          quizQuestionsContainer.innerHTML = questionsHTML;
          
          if (quizPlaceholder) {
            quizPlaceholder.classList.add('hidden');
          }
          
          quizQuestionsContainer.classList.remove('hidden');
          quizQuestionsContainer.classList.add('fade-in');
          
          console.log('Quiz rendered successfully');
        } catch (renderError) {
          console.error('Error rendering quiz:', renderError);
          quizQuestionsContainer.innerHTML = '<p>Error displaying quiz. Please try again.</p>';
          quizQuestionsContainer.classList.remove('hidden');
        }
      } else if (quizPlaceholder) {
        quizPlaceholder.innerHTML = '<p>No questions could be generated. Please try a different topic!</p>';
        quizPlaceholder.classList.remove('hidden');
      }
    }
  
    // Handle answer toggling if toggle button exists
    if (toggleAnswersBtn) {
      toggleAnswersBtn.addEventListener('click', () => {
        if (!quizQuestionsContainer) return;
        
        const explanations = quizQuestionsContainer.querySelectorAll('.explanation');
        const correctOptions = quizQuestionsContainer.querySelectorAll('.option.correct');
        const showingAnswers = toggleAnswersBtn.classList.toggle('showing-answers');
  
        if (showingAnswers) {
          explanations.forEach(explanation => explanation.classList.remove('hidden'));
          correctOptions.forEach(option => option.classList.add('highlight'));
          toggleAnswersBtn.innerHTML = <i class="fas fa-eye-slash"></i> <span>Hide Answers</span>;
        } else {
          explanations.forEach(explanation => explanation.classList.add('hidden'));
          correctOptions.forEach(option => option.classList.remove('highlight'));
          toggleAnswersBtn.innerHTML = <i class="fas fa-eye"></i> <span>Show Answers</span>;
        }
      });
    }
  
    // Handle quiz export if export button exists
    if (exportQuizBtn) {
      exportQuizBtn.addEventListener('click', () => {
        if (!quizQuestionsContainer) return;
        
        const questionsElements = quizQuestionsContainer.querySelectorAll('.question');
        
        if (questionsElements.length === 0) {
          alert('No quiz to export yet! Generate a quiz first.');
          return;
        }
  
        try {
          const topicElement = getElement('#topic');
          const difficultyElement = getElement('input[name="difficulty"]:checked');
          
          let quizText = Quiz on: ${topicElement ? topicElement.value : 'Various Topics'}\n;
          quizText += Difficulty: ${difficultyElement ? difficultyElement.value : 'mixed'}\n\n;
  
          questionsElements.forEach((questionEl, index) => {
            const questionHeaderEl = questionEl.querySelector('h4');
            const questionText = questionHeaderEl ? 
              questionHeaderEl.textContent.replace(`Question ${index + 1}: `, '') : 
              Question ${index + 1};
              
            quizText += ${index + 1}. ${questionText}\n;
  
            const options = questionEl.querySelectorAll('.option');
            options.forEach((opt, i) => {
              const isCorrect = opt.classList.contains('correct');
              const optionText = opt.textContent.trim().replace(/^[A-Z]/, '').trim();
              quizText += `   ${String.fromCharCode(65 + i)}. ${optionText} ${isCorrect ? '(CORRECT)' : ''}\n`;
            });
  
            const explanation = questionEl.querySelector('.explanation');
            if (explanation) {
              quizText += `   Explanation: ${explanation.textContent.replace('Explanation:', '').trim()}\n`;
            }
            
            quizText += '\n';
          });
  
          // Create a Blob and download
          const blob = new Blob([quizText], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          const fileName = topicElement ? 
            quiz-${topicElement.value.replace(/\s+/g, '-').toLowerCase()}.txt : 
            'quiz.txt';
            
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          
          console.log('Quiz exported successfully');
        } catch (exportError) {
          console.error('Error exporting quiz:', exportError);
          alert('Error exporting quiz. Please try again.');
        }
      });
    }
  
    // Learning objectives tags functionality
    const tagInput = getElement('#learning-objective');
    const tagsContainer = getElement('.tags-container');
    
    if (tagInput && tagsContainer) {
      tagInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter' && this.value.trim() !== '') {
          e.preventDefault();
          const tag = document.createElement('div');
          tag.className = 'tag';
          tag.innerHTML = ${this.value.trim()} <span class="remove-tag">&times;</span>;
          tagsContainer.appendChild(tag);
          this.value = '';
  
          // Add event listener to remove tag
          const removeBtn = tag.querySelector('.remove-tag');
          if (removeBtn) {
            removeBtn.addEventListener('click', function() {
              tagsContainer.removeChild(tag);
            });
          }
        }
      });
    }
  
    // Number input controls
    const decreaseBtn = getElement('.decrease');
    const increaseBtn = getElement('.increase');
    const questionsInput = getElement('#questions');
  
    if (decreaseBtn && questionsInput) {
      decreaseBtn.addEventListener('click', () => {
        const minValue = parseInt(questionsInput.min || '1');
        if (parseInt(questionsInput.value) > minValue) {
          questionsInput.value = parseInt(questionsInput.value) - 1;
        }
      });
    }
  
    if (increaseBtn && questionsInput) {
      increaseBtn.addEventListener('click', () => {
        const maxValue = parseInt(questionsInput.max || '50');
        if (parseInt(questionsInput.value) < maxValue) {
          questionsInput.value = parseInt(questionsInput.value) + 1;
        }
      });
    }
  
    // Modal functionality
    const authModal = getElement('#authModal');
    const closeBtn = getElement('.close-btn');
    const signupBtn = getElement('.signup-btn');
    const loginBtn = getElement('.login-btn');
  
    // Show modal on signup/login button click
    if (signupBtn && authModal) {
      signupBtn.addEventListener('click', () => {
        authModal.classList.add('open');
        const authButton = getElement('#authForm button');
        if (authButton) {
          authButton.textContent = 'Sign Up';
        }
      });
    }
  
    if (loginBtn && authModal) {
      loginBtn.addEventListener('click', () => {
        authModal.classList.add('open');
        const authButton = getElement('#authForm button');
        if (authButton) {
          authButton.textContent = 'Log In';
        }
        const authParagraph = getElement('#authForm p');
        if (authParagraph) {
          authParagraph.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleForm()">Sign Up</a>';
        }
      });
    }
  
    // Close modal when clicking the close button
    if (closeBtn && authModal) {
      closeBtn.addEventListener('click', () => {
        authModal.classList.remove('open');
      });
    }
  
    // Close modal when clicking outside
    if (authModal) {
      window.addEventListener('click', (e) => {
        if (e.target === authModal) {
          authModal.classList.remove('open');
        }
      });
    }
  
    // For debugging
    console.log('QuizGen script initialized successfully');
  });
  
  // This needs to be in global scope since it's called from HTML
  function toggleForm() {
    const form = document.getElementById("authForm");
    if (!form) {
      console.error("Auth form not found");
      return;
    }
    
    const actionButton = form.querySelector("button");
    if (!actionButton) {
      console.error("Action button not found in auth form");
      return;
    }
  
    if (actionButton.textContent === "Sign Up") {
      actionButton.textContent = "Log In";
      const paragraph = form.querySelector("p");
      if (paragraph) {
        paragraph.innerHTML = 'Don\'t have an account? <a href="#" onclick="toggleForm()">Sign Up</a>';
      }
    } else {
      actionButton.textContent = "Sign Up";
      const paragraph = form.querySelector("p");
      if (paragraph) {
        paragraph.innerHTML = 'Already have an account? <a href="#" onclick="toggleForm()">Log In</a>';
      }
    }
  }
  
  // Function to close modal, also accessible from HTML
  function closeModal() {
    const authModal = document.getElementById("authModal");
    if (authModal) {
      authModal.classList.remove("open");
    }
  }