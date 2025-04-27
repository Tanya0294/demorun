from flask_wtf import FlaskForm
from wtforms import StringField, IntegerField, SubmitField
from wtforms.validators import DataRequired, NumberRange

class QuizForm(FlaskForm):
    topic = StringField('Topic', validators=[DataRequired()])
    num_questions = IntegerField('Number of Questions', validators=[DataRequired(), NumberRange(min=1, max=20)])
    submit = SubmitField('Generate Quiz')
