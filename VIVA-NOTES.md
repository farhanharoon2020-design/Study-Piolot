# Easy Viva Notes
Muhammad Farhan Haroon | FA24-BSE-052

## Explain your project in 30 seconds
"I made a student registration form using HTML, CSS, JavaScript and Bootstrap 5. HTML creates the fields. CSS gives it a blue, yellow and black design. Bootstrap makes the layout responsive. JavaScript checks the input and shows errors without refreshing the page. This is a front-end demo, so it does not store or send data."

## Learn these first
1. HTML = structure (what appears on the page).
2. CSS = style (colors, spacing and layout).
3. JavaScript = behavior (checking the form).
4. Bootstrap = ready-made CSS classes for responsive design.
5. DOM = the page represented as objects JavaScript can read and change.
6. Regex = a pattern used to check text.

## Likely questions
**What does required do?** It says the user must fill the field.

**Why novalidate on the form?** It disables the browser's automatic submit popups so my JavaScript can show messages below the fields. checkValidity() still checks HTML rules when I call it.

**What does preventDefault() do?** Stops the normal form submission and page refresh.

**How do you select an element?** getElementById("studentForm") selects by ID. querySelector() selects the first CSS selector match. querySelectorAll() selects all matches.

**What is addEventListener()?** It runs a function when an event occurs.

**Which events did you use?** submit when submitting; click when pressing the button; input when typing; change when a value changes; blur when leaving a field.

**Why use a loop?** To check every field without writing the same code separately for each one.

**What are var, let and const?** var is function-scoped; let is block-scoped and can be reassigned; const is block-scoped and cannot be reassigned. A const object can still have its contents changed.

**What does return error === "" mean?** It returns true when there is no error, and false when an error exists.

**What does setCustomValidity() do?** A nonempty message marks an input invalid. An empty string clears that custom error.

**How do passwords match?** I compare the confirm-password value with the password value using !==. If they differ, I show an error.

**Does this create an account?** No. A server and database are needed for that.

**Can someone bypass JavaScript validation?** Yes. A real server must validate the data again.

## Understand the phone regex
`/^03[0-9]{9}$/`
- / / surround a JavaScript regex.
- ^ means start of text.
- 03 means those exact digits.
- [0-9] means any digit.
- {9} means exactly nine repetitions.
- $ means end of text.
- So 03 plus nine digits = 11 digits total.

## Other regex rules
- [A-Za-z ] = English letters and spaces.
- {3,80} = between 3 and 80 characters.
- [A-Za-z0-9_] = letters, digits and underscore.
- {5,15} = between 5 and 15 characters.
- \d means a digit; \s means whitespace.
- (?=.*[A-Z]) is a lookahead: it requires an uppercase letter somewhere.
- The password pattern has similar checks for lowercase, digit and special character.
- test() answers true or false; see README for all five methods.

## CSS and responsive layout
**What is :root?** Where I defined reusable CSS variables, such as --blue.

**Flexbox versus Grid?** Flexbox arranges items mainly in one direction. Grid can arrange rows and columns. My navigation uses Flexbox and the icon uses Grid for centering; Bootstrap handles the page columns.

**What is a media query?** CSS applied under a condition, such as a screen width below 576px.

**What is a pseudo-class?** A selector for a state: :hover, :focus, :valid, :invalid or :checked.

**Position values?** relative positions an element relative to its normal location; absolute uses its positioned ancestor; fixed stays in the viewport; sticky sticks after reaching a scroll position.

**Where are these used?** Form card: relative. Top decoration: absolute. Back-to-top link: fixed. Header: sticky.

**Transition versus transform?** A transition animates a change over time. A transform moves, rotates or scales an element. My button moves up slightly on hover.

**What are fieldset and legend?** They group related fields and name the group.

## Follow the JavaScript in order
1. Select the form and message.
2. Define regex patterns.
3. validateField() checks one field and displays its error.
4. validateGender() checks the radio group.
5. Loops attach events to the fields.
6. handleSubmit() stops refresh, checks everything and shows the result.

Practice changing the heading, theme color and one error message yourself. Explain each change aloud. Understanding these small changes is more useful than memorizing the whole file.
