class FormValidator {
    constructor(rules = {}) {
        this.rules = rules;                // правила для полей { field: { pattern, message, required, ... } }
        this.errors = {};
        this.customValidators = {};        // именованные кастомные функции
        this.masks = {};                    // маски для полей { field: maskString }
        this.formatters = {};                // функции форматирования для полей
    }

    // Добавить правило для поля
    addRule(field, rule) {
        this.rules[field] = { ...(this.rules[field] || {}), ...rule };
    }

    // Валидация одного поля
    validateField(field, value) {
        const rule = this.rules[field];
        if (!rule) return true; // нет правил – ок

        // Обязательность
        if (rule.required && (value === undefined || value === null || value === '')) {
            this.errors[field] = rule.messageRequired || 'Обязательное поле';
            return false;
        }

        // Кастомный валидатор по имени
        if (rule.custom && this.customValidators[rule.custom]) {
            const customResult = this.customValidators[rule.custom](value, field, this);
            if (customResult !== true) {
                this.errors[field] = customResult || 'Ошибка кастомной проверки';
                return false;
            }
        }

        // Проверка по регулярному выражению
        if (rule.pattern) {
            const regex = rule.pattern instanceof RegExp ? rule.pattern : new RegExp(rule.pattern);
            if (!regex.test(value)) {
                this.errors[field] = rule.message || 'Некорректное значение';
                return false;
            }
        }

        // Дополнительные проверки (функция)
        if (rule.validate && typeof rule.validate === 'function') {
            const funcResult = rule.validate(value);
            if (funcResult !== true) {
                this.errors[field] = funcResult || rule.message || 'Ошибка';
                return false;
            }
        }

        // Всё хорошо
        delete this.errors[field];
        return true;
    }

    // Валидация всей формы (объект field->value)
    validateForm(data) {
        this.errors = {};
        let isValid = true;
        for (const field in this.rules) {
            if (this.rules.hasOwnProperty(field)) {
                const ok = this.validateField(field, data[field]);
                if (!ok) isValid = false;
            }
        }
        return { isValid, errors: this.errors };
    }

    // Добавить кастомный валидатор
    setCustomValidator(name, validatorFn) {
        this.customValidators[name] = validatorFn;
    }

    // Форматирование значения
    formatValue(field, value) {
        const rule = this.rules[field];
        if (rule && rule.format && typeof rule.format === 'function') {
            return rule.format(value);
        }
        if (this.formatters[field]) {
            return this.formatters[field](value);
        }
        return value;
    }

    // Создание маски ввода сохраняем маску и возвращаем функцию для обработки input
    createMask(field, maskString) {
        this.masks[field] = maskString;
        // функция, которую можно навесить на input
        return (inputValue) => {
            return this.applyMask(inputValue, maskString);
        };
    }

    // Применить маску к сырому значению
    applyMask(value, mask) {
        if (!value) return '';
        // очищаем от всех не-цифр и не-букв
        // для простоты будем заменять # на цифры, остальные символы маски оставляем
        let raw = value.replace(/[^0-9a-zA-Z]/g, '');
        let result = '';
        let rawIndex = 0;
        for (let i = 0; i < mask.length; i++) {
            if (rawIndex >= raw.length) break;
            if (mask[i] === '#') {
                // ожидаем цифру
                if (/[0-9]/.test(raw[rawIndex])) {
                    result += raw[rawIndex];
                    rawIndex++;
                } else {
                    // если символ не цифра, пропускаем его в raw он не подходит
                    rawIndex++;
                    i--; // повторить этот символ маски
                }
            } else if (mask[i] === '@') {
                // буква
                if (/[a-zA-Z]/.test(raw[rawIndex])) {
                    result += raw[rawIndex];
                    rawIndex++;
                } else {
                    rawIndex++;
                    i--;
                }
            } else {
                // постоянный символ маски
                result += mask[i];
                // если следующий raw символ совпадает с этим символом, можно его пропустить
                if (raw[rawIndex] === mask[i]) {
                    rawIndex++;
                }
            }
        }
        return result;
    }
}

const validator = new FormValidator();

// Email
validator.addRule('email', {
    pattern: /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/,
    message: 'Некорректный email. Пример: name@domain.com',
    required: true,
    messageRequired: 'Введите email'
});

// Телефон
validator.addRule('phone', {
    pattern: /^\+7 \(\d{3}\) \d{3}-\d{4}$/,  // строгий формат после маски
    message: 'Формат: +7 (912) 123-4567',
    required: true,
    format: (val) => { // очистка от лишнего перед валидацией
        return val.replace(/[^\d+]/g, '');
    }
});

// Пароль
validator.addRule('password', {
    required: true,
    messageRequired: 'Пароль обязателен',
    validate: (value) => {
        const errors = [];
        if (value.length < 6) errors.push('минимум 6 символов');
        if (!/[A-Z]/.test(value)) errors.push('нужна заглавная буква');
        if (!/[0-9]/.test(value)) errors.push('нужна цифра');
        if (!/[!@#$%^&*]/.test(value)) errors.push('нужен спецсимвол (!@#$%^&*)');
        if (errors.length) return 'Слабый: ' + errors.join(', ');
        if (value.length >= 10 && /[A-Z]/.test(value) && /[0-9]/.test(value) && /[!@#$%^&*]/.test(value)) return true; // сильный
        if (value.length >= 8) return true; // средний
        return true; // проходим, но силу покажем отдельно
    }
});

// Подтверждение пароля — обрабатываем отдельно вручную
validator.addRule('confirmPassword', {
    required: true,
    messageRequired: 'Подтвердите пароль',
    validate: (value, field, self) => {
        const password = document?.getElementById('password')?.value || '';
        if (value !== password) return 'Пароли не совпадают';
        return true;
    }
});

// URL
validator.addRule('url', {
    pattern: /^(https?|ftp):\/\/[^\s/$.?#].[^\s]*$/i,
    message: 'Введите корректный URL с протоколом (http, https, ftp)',
    required: false
});

// Дата (поддерживаем ДД.ММ.ГГГГ или ГГГГ-ММ-ДД)
validator.addRule('date', {
    validate: (value) => {
        if (!value) return true;
        let match;
        if ((match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/))) {
            let [_, d, m, y] = match;
            let date = new Date(+y, +m-1, +d);
            if (date && date.getFullYear() == y && date.getMonth() == m-1 && date.getDate() == d) return true;
        } else if ((match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/))) {
            let [_, y, m, d] = match;
            let date = new Date(+y, +m-1, +d);
            if (date && date.getFullYear() == y && date.getMonth() == m-1 && date.getDate() == d) return true;
        }
        return 'Неверная дата (используйте ДД.ММ.ГГГГ или ГГГГ-ММ-ДД)';
    }
});

// Файл
validator.addRule('file', {
    validate: (file) => {
        if (!file || !file.size) return true; // не обязателен
        if (file.size > 2 * 1024 * 1024) return 'Размер файла не должен превышать 2 МБ';
        if (!file.type.startsWith('image/')) return 'Разрешены только изображения';
        return true;
    }
});

// Кастомный валидатор
validator.setCustomValidator('adult', (value) => {
    const age = parseInt(value, 10);
    if (isNaN(age) || age < 18) return 'Возраст должен быть 18+';
    return true;
});

// Добавим поле "возраст" в кастомные тесты, но не в основную форму
validator.addRule('customAge', {
    custom: 'adult',
    message: 'Вы должны быть совершеннолетним'
});

// Создадим маску для телефона и сохраним
const phoneMask = '+7 (###) ###-####';
const masker = validator.createMask('phone', phoneMask);

const emailInput = document.getElementById('email');
const phoneInput = document.getElementById('phone');
const passwordInput = document.getElementById('password');
const confirmInput = document.getElementById('confirmPassword');
const urlInput = document.getElementById('url');
const dateInput = document.getElementById('date');
const fileInput = document.getElementById('file');
const emailError = document.getElementById('emailError');
const phoneError = document.getElementById('phoneError');
const passwordError = document.getElementById('passwordError');
const confirmError = document.getElementById('confirmError');
const urlError = document.getElementById('urlError');
const dateError = document.getElementById('dateError');
const fileError = document.getElementById('fileError');
const strengthBar = document.getElementById('strengthBar');
const phoneMaskPreview = document.getElementById('phoneMaskPreview');
const formResult = document.getElementById('formResult');
const testOutput = document.getElementById('testOutput');

// Функция обновления ошибок в интерфейсе
function updateUIField(field, value) {
    validator.validateField(field, value);
    const error = validator.errors[field] || '';
    switch (field) {
        case 'email': emailError.textContent = error; emailInput.classList.toggle('error', !!error); break;
        case 'phone': phoneError.textContent = error; phoneInput.classList.toggle('error', !!error); break;
        case 'password': passwordError.textContent = error; passwordInput.classList.toggle('error', !!error); updatePasswordStrength(value); break;
        case 'confirmPassword': confirmError.textContent = error; confirmInput.classList.toggle('error', !!error); break;
        case 'url': urlError.textContent = error; urlInput.classList.toggle('error', !!error); break;
        case 'date': dateError.textContent = error; dateInput.classList.toggle('error', !!error); break;
        case 'file': fileError.textContent = error; fileInput.classList.toggle('error', !!error); break;
    }
}

// Индикатор силы пароля
function updatePasswordStrength(pass) {
    let strength = 0;
    if (pass.length >= 6) strength++;
    if (pass.length >= 8) strength++;
    if (/[A-Z]/.test(pass)) strength++;
    if (/[0-9]/.test(pass)) strength++;
    if (/[!@#$%^&*]/.test(pass)) strength++;
    strength = Math.min(4, Math.floor(strength / 1.5));
    strengthBar.className = 'strength-bar';
    if (pass.length === 0) strengthBar.style.width = '0%';
    else strengthBar.classList.add(`strength-${strength}`);
}

// Маска для телефона при вводе
phoneInput.addEventListener('input', (e) => {
    let raw = e.target.value;
    let masked = masker(raw);
    phoneInput.value = masked;
    phoneMaskPreview.textContent = `🔍 по маске: ${masked || '—'}`;
    updateUIField('phone', masked);
});

// Валидация по потере фокуса
emailInput.addEventListener('blur', () => updateUIField('email', emailInput.value));
passwordInput.addEventListener('input', () => updateUIField('password', passwordInput.value));
confirmInput.addEventListener('input', () => updateUIField('confirmPassword', confirmInput.value));
urlInput.addEventListener('blur', () => updateUIField('url', urlInput.value));
dateInput.addEventListener('blur', () => updateUIField('date', dateInput.value));
fileInput.addEventListener('change', () => updateUIField('file', fileInput.files[0]));

// Кнопка проверки всей формы
document.getElementById('validateFormBtn').addEventListener('click', () => {
    const data = {
        email: emailInput.value,
        phone: phoneInput.value,
        password: passwordInput.value,
        confirmPassword: confirmInput.value,
        url: urlInput.value,
        date: dateInput.value,
        file: fileInput.files[0]
    };
    const result = validator.validateForm(data);
    if (result.isValid) formResult.innerHTML = '✅ Форма валидна!';
    else {
        let html = '❌ Ошибки:<br>';
        for (let f in result.errors) html += `• ${f}: ${result.errors[f]}<br>`;
        formResult.innerHTML = html;
    }
});

// Асинхронная валидация
document.getElementById('asyncValidateBtn').addEventListener('click', () => {
    const email = emailInput.value;
    formResult.innerHTML = '⏳ Проверка email на сервере...';
    setTimeout(() => {
        if (email.includes('test') || email.includes('example')) {
            formResult.innerHTML = '✅ Email доступен (асинхронно)';
        } else {
            formResult.innerHTML = '❌ Email уже используется (асинхронно)';
        }
    }, 1500);
});

const testButtons = document.querySelectorAll('[data-test]');
function runTest(testName) {
    let report = `🧪 Тест «${testName}»\n`;
    switch (testName) {
        case 'email':
            report += testEmail(); break;
        case 'phone':
            report += testPhone(); break;
        case 'password':
            report += testPassword(); break;
        case 'url':
            report += testUrl(); break;
        case 'date':
            report += testDate(); break;
        case 'file':
            report += testFile(); break;
        case 'custom':
            report += testCustom(); break;
        case 'dependent':
            report += testDependent(); break;
        default: report += 'Неизвестный тест';
    }
    testOutput.innerHTML = report.replace(/\n/g, '<br>');
}

function testEmail() {
    const cases = [
        { val: 'test@example.com', expect: true },
        { val: 'invalid', expect: false },
        { val: 'missing@domain', expect: false },
        { val: 'user@.com', expect: false },
        { val: 'user+alias@domain.co.uk', expect: true },
        { val: '', expect: false } // required
    ];
    let out = '';
    cases.forEach((c, i) => {
        const res = validator.validateField('email', c.val);
        validator.errors = {}; // сброс
        out += `  #${i+1}: "${c.val}" → ${res === c.expect ? '✅' : '❌'} (ожидался ${c.expect})\n`;
    });
    return out;
}

function testPhone() {
    const cases = [
        { val: '+7 (912) 345-6789', expect: true },
        { val: '+7 (123) 456-7890', expect: true },
        { val: '89123456789', expect: false }, // не проходит маску
        { val: '+7 (000) 000-0000', expect: true },
        { val: '123', expect: false },
    ];
    let out = '';
    cases.forEach((c, i) => {
        const res = validator.validateField('phone', c.val);
        validator.errors = {};
        out += `  #${i+1}: "${c.val}" → ${res === c.expect ? '✅' : '❌'} (ожид. ${c.expect})\n`;
    });
    return out;
}

function testPassword() {
    const cases = [
        { val: 'StrongPass1!', expect: true },
        { val: 'weak', expect: false },
        { val: 'NoNumber!', expect: false },
        { val: '12345678', expect: false },
        { val: 'Valid1!', expect: true }, // >=6, загл, цифра, спец
    ];
    let out = '';
    cases.forEach((c, i) => {
        const res = validator.validateField('password', c.val);
        validator.errors = {};
        out += `  #${i+1}: "${c.val}" → ${res === c.expect ? '✅' : '❌'}\n`;
    });
    return out;
}

function testUrl() {
    const cases = [
        { val: 'https://google.com', expect: true },
        { val: 'ftp://files.ru', expect: true },
        { val: 'http://localhost:3000', expect: true },
        { val: 'www.example.com', expect: false },
        { val: 'https://', expect: false },
    ];
    let out = '';
    cases.forEach((c, i) => {
        const res = validator.validateField('url', c.val);
        validator.errors = {};
        out += `  #${i+1}: "${c.val}" → ${res === c.expect ? '✅' : '❌'}\n`;
    });
    return out;
}

function testDate() {
    const cases = [
        { val: '15.03.2024', expect: true },
        { val: '2024-03-15', expect: true },
        { val: '32.01.2023', expect: false },
        { val: '2023-13-01', expect: false },
        { val: '01/01/2024', expect: false }, // неподдерживаемый формат
    ];
    let out = '';
    cases.forEach((c, i) => {
        const res = validator.validateField('date', c.val);
        validator.errors = {};
        out += `  #${i+1}: "${c.val}" → ${res === c.expect ? '✅' : '❌'}\n`;
    });
    return out;
}

function testFile() {
    const cases = [
        { file: { size: 1e6, type: 'image/png' }, expect: true },
        { file: { size: 3e6, type: 'image/png' }, expect: false },
        { file: { size: 1e6, type: 'text/plain' }, expect: false },
    ];
    let out = '';
    cases.forEach((c, i) => {
        const res = validator.validateField('file', c.file);
        validator.errors = {};
        out += `  #${i+1}: size=${c.file.size}, type=${c.file.type} → ${res === c.expect ? '✅' : '❌'}\n`;
    });
    return out;
}

function testCustom() {
    // используем кастомный валидатор adult для возраста
    validator.addRule('age', { custom: 'adult', required: true, message: '18+' });
    const cases = [25, 17, '20', 'abc', 18];
    let out = '';
    cases.forEach((val, i) => {
        const res = validator.validateField('age', val);
        validator.errors = {};
        out += `  #${i+1}: возраст ${val} → ${res ? '✅' : '❌'}\n`;
    });
    return out;
}

function testDependent() {
    // имитация: пароль и подтверждение
    document.getElementById('password').value = 'Secret1!';
    document.getElementById('confirmPassword').value = 'Secret1!';
    let r1 = validator.validateField('confirmPassword', 'Secret1!');
    document.getElementById('confirmPassword').value = 'Mismatch';
    let r2 = validator.validateField('confirmPassword', 'Mismatch');
    let out = `  Совпадают: ${r1 ? '✅' : '❌'}\n  Не совпадают: ${!r2 ? '✅' : '❌'}`;
    // сброс полей
    document.getElementById('password').value = '';
    document.getElementById('confirmPassword').value = '';
    return out;
}

testButtons.forEach(btn => {
    btn.addEventListener('click', () => runTest(btn.dataset.test));
});

document.getElementById('testRegexBtn').addEventListener('click', () => {
    const pattern = document.getElementById('regexPattern').value;
    const flags = document.getElementById('regexFlags').value;
    const testStr = document.getElementById('regexTestString').value;
    try {
        const regex = new RegExp(pattern, flags);
        const ok = regex.test(testStr);
        document.getElementById('regexResult').innerHTML = `✅ Результат: <strong>${ok}</strong> (/${pattern}/${flags}.test("${testStr}"))`;
    } catch (e) {
        document.getElementById('regexResult').innerHTML = `❌ Ошибка: ${e.message}`;
    }
});

// Инициализация предпросмотра маски
phoneMaskPreview.textContent = '🔍 по маске: ';