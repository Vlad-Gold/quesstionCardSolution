// Тестовое задание - QuestionCard

// Часть 1. Архитектура компонента

/*
Структура QuestionCard:

QuestionCard (основной контейнер)
├── QuestionStem (рендерер TipTap + KaTeX)
│   ├── TipTapContent (основной контент)
│   └── KaTeXRenderer (математические формулы)
├── AnswerOptions (список вариантов ответа)
│   ├── OptionItem (каждый вариант)
│   └── OptionRadio (радиокнопка + текст)
├── ActionBar (панель действий)
│   ├── CheckButton (кнопка "Проверить")
│   └── NextButton (кнопка "Следующий вопрос")
└── Explanation (объяснение - условный рендер)
    ├── ExplanationContent (текст объяснения)
    └── DemoOverlay (блюр для demo режима)

Хранение состояния:
- selectedAnswer: локальное состояние в QuestionCard (useState)
- isChecked: локальное состояние в QuestionCard (useState) 
- isLoading: локальное состояние для индикации загрузки
- error: локальное состояние для обработки ошибок API
- questionData: приходит из props (глобальное состояние хранилища)
- isDemoMode: глобальный флаг из контекста/стора

Что сбрасывается при смене questionId:
- selectedAnswer → null
- isChecked → false
- isLoading → false
- error → null

Если пользователь кликает очень быстро:
- Первый клик обрабатывается нормально
- Последующие клики игнорируются через флаг isLoading
- API запросы debounce'ятся или отменяются (AbortController)
- UI показывает спиннер, не дает изменить ответ во время проверки
*/


// Часть 2. Псевдокод логики

// Основной компонент QuestionCard
function QuestionCard(questionData, isDemoMode) {

    let selectedAnswer = null
    let isChecked = false
    let isLoading = false
    let error = null
    
    useEffect(() => {
        resetState()
    }, [questionData.id])
    
    function resetState() {
        selectedAnswer = null
        isChecked = false
        isLoading = false
        error = null
    }
    
    function selectAnswer(answerId) {
        if (isChecked || isLoading) return
        
        selectedAnswer = answerId
        error = null
    }
    
    async function checkAnswer() {
        if (!selectedAnswer || isLoading) return
        
        isLoading = true
        error = null
        
        try {
            const result = await api.checkAnswer({
                questionId: questionData.id,
                answerId: selectedAnswer
            })
            
            isChecked = true
            
        } catch (err) {
            error = "Ошибка при проверке ответа. Попробуйте еще раз."
        } finally {
            isLoading = false
        }
    }
    
    function nextQuestion() {
        if (isLoading) return
        onNextQuestion()
    }

    const isCheckDisabled = !selectedAnswer || isLoading
    const isNextDisabled = !isChecked || isLoading
    const showExplanation = isChecked && !isDemoMode
    
    return {
        stem: renderTipTap(questionData.stem),
        options: renderOptions(questionData.options, selectedAnswer, selectAnswer, isChecked),
        checkButton: renderButton("Проверить", checkAnswer, isCheckDisabled),
        nextButton: renderButton("Следующий", nextQuestion, isNextDisabled),
        explanation: showExplanation ? renderExplanation(questionData.explanation) : null,
        demoOverlay: isDemoMode && isChecked ? renderDemoOverlay() : null,
        error: error ? renderError(error) : null,
        loading: isLoading ? renderSpinner() : null
    }
}

function renderTipTap(content) {
    try {
        return tipTapRenderer.render(content)
    } catch (error) {
        return renderFallbackContent(content)
    }
}

function renderKaTeX(formula) {
    try {
        return katex.renderToString(formula)
    } catch (error) {
        return `<span class="math-error">[Ошибка формулы]</span>`
    }
}

function renderOptions(options, selectedAnswer, onSelect, isChecked) {
    return options.map(option => ({
        id: option.id,
        text: renderTipTap(option.text),
        isSelected: option.id === selectedAnswer,
        isCorrect: isChecked ? option.isCorrect : null,
        onClick: () => onSelect(option.id),
        disabled: isChecked
    }))
}

// Часть 3. Edge cases и UX

/*
Как поведет себя UI в разных ситуациях:
1. Explanation отсутствует:
   - После проверки ответа просто не показывается блок explanation
   - Кнопка "Следующий" активна как обычно
   - Никаких ошибок - просто пустое место

2. В stem только формулы:
   - KaTeX рендерит все формулы последовательно
   - Если KaTeX падает - показываем fallback текст "[Ошибка формулы]"
   - Вертикальные отступы между формулами сохраняются

3. В stem очень длинный текст:
   - Вопрос в карточке скроллится (max-height + overflow-y: auto)
   - Варианты ответа всегда видны (фиксированы внизу)
   - Для мобильных - адаптивный шрифт и отступы

4. KaTeX упал с ошибкой:
   - Ловим ошибку в try-catch при рендере
   - Показываем заглушку "[Математическая формула недоступна]"
   - Логируем ошибку в консоль для отладки
   - Остальной контент вопроса продолжает работать

5. Пользователь меняет ответ после check:
   - Кнопки ответов становятся disabled после проверки
   - Выбранный ответ подсвечивается (зеленым/красным)
   - Смена ответа невозможна - нужно перейти к следующему вопросу
   - Это защищает от накрутки и сохраняет логику проверки

6. Пользователь в demo режиме:
   - Explanation скрыт или размыт (blur filter)
   - Появляется плашка с текстом: "Это демо-версия. Полное объяснение доступно в платной версии"
   - CTA кнопка "Получить полный доступ" с переходом на страницу оплаты
   - Функционал проверки ответов работает, но без подробных объяснений
   - Можно ограничить количество вопросов в demo (например, 3 вопроса)

Demo режим - UX детали:
Когда пользователь в demo режиме пытается получить объяснение:
1. Проверка ответа работает нормально
2. Вместо explanation показывается размытый блок с заглушкой
3. Сверху появляется баннер: " то демо-версия. Купите полный доступ чтобы видеть подробные объяснения"
4. Кнопка "Узнать больше" ведет на тарифы
5. Можно показать счетчик оставшихся demo вопросов: "Осталось 2 вопроса из 3"
*/

// Дополнительно
/*
Производительность и оптимизация:
- TipTap контент кэшируется после первого рендера
- KaTeX формулы рендерятся лениво (lazy loading)
- API запросы имеют таймаут 10 секунд
- Используем React.memo для переиспользования компонентов
- Дебаунс на быстрые клики (300ms)

Доступность (a11y):
- Радиокнопки имеют proper labels
- Формулы имеют aria-label с текстовым описанием
- Кнопки имеют состояния для screen readers
- Цветовая контрастность соответствует WCAG AA
*/

// Псевдокод для demo режима
function renderDemoOverlay() {
    return {
        type: 'overlay',
        content: {
            blurredExplanation: true,
            banner: {
                text: "Демо-версия",
                subtext: "Полное объяснение доступно в платной версии"
            },
            ctaButton: {
                text: "Получить полный доступ",
                action: () => navigateTo('/pricing')
            },
            remainingQuestions: `Осталось ${demoQuestionsLeft} из ${demoQuestionsTotal}`
        }
    }
}

// Обработка demo ограничений
function handleDemoLimit() {
    if (demoQuestionsUsed >= demoQuestionsLimit) {
        showPaywall()
        return true
    }
    return false
}

function showPaywall() {
    return {
        type: 'paywall',
        title: "Лимит demo вопросов исчерпан",
        message: "Для продолжения обучения необходимо приобрести подписку",
        actions: [
            { text: "Выбрать тариф", action: () => navigateTo('/pricing') },
            { text: "Войти в аккаунт", action: () => navigateTo('/login') }
        ]
    }
}