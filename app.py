from flask import Flask, render_template, redirect, url_for, request, session
from forms import QuizForm
from quiz_generator import generate_quiz

app = Flask(__name__)
app.config['SECRET_KEY'] =  'something-super-secret-12345'
@app.route('/', methods=['GET', 'POST'])
def home():
    form = QuizForm()
    if form.validate_on_submit():
        topic = form.topic.data
        num_questions = form.num_questions.data
        quiz = generate_quiz(topic, num_questions)
        session['quiz'] = quiz
        return redirect(url_for('quiz'))
    return render_template('home.html', form=form)

@app.route('/quiz', methods=['GET', 'POST'])
def quiz():
    quiz = session.get('quiz', [])
    if request.method == 'POST':
        correct = 0
        for idx, q in enumerate(quiz):
            selected = request.form.get(f"q{idx}")
            if selected == q['answer']:
                correct += 1
        score = f"{correct} / {len(quiz)}"
        return render_template('result.html', score=score)
    return render_template('quiz.html', quiz=quiz)

if __name__ == '__main__':
    app.run(debug=True)

