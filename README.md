# Student Registration Project

**Muhammad Farhan Haroon — FA24-BSE-052**

## Open the project
1. Extract the ZIP.
2. In VS Code choose File > Open Folder and select the extracted folder.
3. Double-click index.html in File Explorer to open it in a browser.

No installation or terminal commands are needed. Internet is needed for Bootstrap 5.3.3. This is a front-end demo; it does not save or send data.

## Files
- index.html: page structure and form.
- style.css: blue, yellow and black styling.
- script.js: form validation and events.
- VIVA-NOTES.md: simple explanations and practice questions.

## Layout
Bootstrap's row contains col-lg-4 and col-lg-8. They take 4 and 8 of 12 columns on large screens (992px and above). Below that, they stack. Inside the form, col-sm-6 makes two input columns at 576px and above. Below that, inputs stack.

## Semantic versus non-semantic HTML
Semantic tags describe their purpose: header, nav, main, section, article, aside, footer, figure and figcaption. A div or span is a general container without a special meaning. Fieldset groups related inputs; legend names the group.

## Regular expression methods
```js
// test(): returns true or false. Used in this form.
/^03[0-9]{9}$/.test('03001234567'); // true

// match(): returns matching text in an array, or null.
'CS101 and CS202'.match(/[0-9]+/g); // ['101', '202']

// replace(): returns a new string with matching text replaced.
'Farhan   Haroon'.replace(/ +/g, ' '); // 'Farhan Haroon'

// search(): returns the first match position, or -1 if absent.
'abc123'.search(/[0-9]/); // 3

// exec(): returns a match array with captured groups, or null.
const result = /([0-9]{5})-([0-9]{7})-([0-9])/.exec('12345-1234567-1');
result[0]; // whole CNIC
result[1]; // '12345', first captured group
```
With a global regex (g), test() and exec() remember lastIndex. Validation expressions here do not use g.

## Try these checks
- Submit an empty form: errors should appear.
- Phone: 03001234567 passes; 04001234567 fails.
- Password: Study@2026 passes; study fails.
- Confirm password must match.
- Age: 16 and 60 pass; 15, 61 and decimals fail.
- Future date of birth fails.
- CNIC: 12345-1234567-1 passes.
- Username: farhan_052 passes; ab fails.
- Gender, course and terms must be selected.
- Optional website must be a valid URL; transcript must have an allowed extension and be no larger than 5 MB.
- Try widths of 320, 576, 768, 992, 1200 and 1440 pixels.

Age and date of birth are checked separately in this simple version. Names use English letters and spaces, as specified in the assignment. File validation checks extension and size only. A real system would also require server-side validation and secure storage.
