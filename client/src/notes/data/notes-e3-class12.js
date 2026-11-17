// Pri Learning · Experience 3 layer for CBSE Class 12 notes (see notes/e3.js). Original writing.
// Every checkpoint answer is re-derived by the engine (client/test/notes-e3-check.mjs); every
// number in a diagram note was computed from the same data as the spec beside it.

const HALF_PI = Math.PI / 2;
const r4 = v => Math.round(v * 1e4) / 1e4;

// The region between y = x + 2 (above) and y = x^2 (below), from x = -1 to x = 2:
// along the line from (-1, 1) to (2, 4), then back along the parabola.
const BETWEEN_LINE_AND_PARABOLA = [[-1, 1], [2, 4]];
for (let x = 1.75; x > -1; x -= 0.25) BETWEEN_LINE_AND_PARABOLA.push([r4(x), r4(x * x)]);

export default {
  'c12-relations-functions': {
    objective: 'Decide whether a relation is reflexive, symmetric and transitive, decide whether a function is one-one and onto, and find the inverse of a bijection.',
    intuition: 'A function is one-one when no two inputs share an output. On a graph that means every horizontal line meets the curve at most once. It is onto its codomain when every value in the codomain is reached, so every horizontal line at a codomain height meets the curve at least once. A bijection does both, so each output can be traced back to exactly one input. That reverse trace is the inverse, and its graph is the reflection of the original in the line $y=x$.',
    check: [
      { question: 'For $f:\\mathbb R\\to\\mathbb R$, $f(x)=5x-2$, find $f^{-1}(13)$.', answer: '$3$', verify: { kind: 'value', expr: '(13+2)/5', answer: '3' } },
      { question: 'On $A=\\{1,2,\\dots,10\\}$ the relation $R=\\{(a,b): 3 \\text{ divides } a-b\\}$ is an equivalence relation. How many elements are in the equivalence class $[1]$?', answer: '$4$, namely $\\{1,4,7,10\\}$', verify: { kind: 'value', expr: 'floor((10-1)/3)+1', answer: '4' } },
      { question: 'Show that $f:\\mathbb R\\setminus\\{2\\}\\to\\mathbb R\\setminus\\{1\\}$, $f(x)=\\dfrac{x+3}{x-2}$, is a bijection and find $f^{-1}(x)$.', answer: '$f^{-1}(x)=\\dfrac{2x+3}{x-1}$. Solving $y=\\dfrac{x+3}{x-2}$ gives $x=\\dfrac{2y+3}{y-1}$, which exists for every $y\\ne1$ and is never $2$, so $f$ is onto; one solution for each $y$ makes it one-one.', verify: { kind: 'equivalent', a: '((2*x+3)/(x-1)+3)/((2*x+3)/(x-1)-2)', b: 'x' } }
    ],
    diagrams: [
      {
        title: 'The horizontal line test on $y=x^3-ax$',
        spec: { kind: 'paramGraph', expr: 'x^3-a*x', params: [{ name: 'a', min: -3, max: 3, step: 1, initial: 3 }], xmin: -3, xmax: 3, ymin: -6, ymax: 6, show: ['roots', 'turning'], fixed: [{ expr: '1', label: 'y=1' }] },
        note: 'With $a=3$ the turning points are $(-1,2)$ and $(1,-2)$, so the line $y=1$ meets the curve three times: $f(x)=x^3-3x$ is onto $\\mathbb R$ but not one-one. Slide $a$ to $0$ or below: the curve only rises, every horizontal line meets it exactly once, and $f$ becomes a bijection.'
      },
      {
        title: '$f(x)=3x-4$ and its inverse',
        spec: { kind: 'function', xmin: -6, xmax: 7, ymin: -6, ymax: 7, curves: [{ expr: '3*x-4', label: 'y=3x-4' }, { expr: '(x+4)/3', label: 'y=\\tfrac{x+4}{3}' }, { expr: 'x', tone: 'secondary', label: 'y=x' }], points: [{ x: 3, y: 5, label: '(3,\\,5)' }, { x: 5, y: 3, label: '(5,\\,3)' }] },
        note: 'Since $f(3)=5$, the point $(3,5)$ is on $y=3x-4$. The inverse sends $5$ back to $3$, so $(5,3)$ is on $y=\\tfrac{x+4}{3}$. Each point is the mirror image of the other in $y=x$.'
      }
    ]
  },

  'c12-inverse-trigonometric': {
    objective: 'Find principal values of the inverse trigonometric functions and simplify expressions with them, keeping every answer inside the principal value range.',
    intuition: '$\\sin x$ takes every value in $[-1,1]$ infinitely often, so "the angle whose sine is $\\tfrac12$" has no single answer until we choose one stretch of the graph. On $\\left[-\\tfrac{\\pi}{2},\\tfrac{\\pi}{2}\\right]$ sine rises from $-1$ to $1$ exactly once, so there it is one-one and onto $[-1,1]$, and its inverse is the reflection of that stretch in $y=x$. Most slips in this chapter come from leaving the chosen stretch: $\\sin^{-1}\\left(\\sin\\tfrac{2\\pi}{3}\\right)$ is $\\tfrac{\\pi}{3}$, not $\\tfrac{2\\pi}{3}$.',
    check: [
      { question: 'Find the principal value of $\\sin^{-1}\\left(-\\tfrac{\\sqrt3}{2}\\right)$.', answer: '$-\\dfrac{\\pi}{3}$', verify: { kind: 'value', expr: 'asin(-sqrt(3)/2)', answer: '-pi/3' } },
      { question: 'Evaluate $\\cos^{-1}\\left(\\cos\\tfrac{7\\pi}{6}\\right)$.', answer: '$\\dfrac{5\\pi}{6}$, since $\\cos\\tfrac{7\\pi}{6}=\\cos\\tfrac{5\\pi}{6}$ and only $\\tfrac{5\\pi}{6}$ lies in $[0,\\pi]$', verify: { kind: 'value', expr: 'acos(cos(7*pi/6))', answer: '5*pi/6' } },
      { question: 'Solve $\\tan^{-1}2x+\\tan^{-1}3x=\\dfrac{\\pi}{4}$.', answer: '$x=\\tfrac16$. Taking $\\tan$ of both sides gives $6x^2+5x-1=0$, so $x=\\tfrac16$ or $x=-1$; at $x=-1$ both terms are negative, so their sum cannot be $\\tfrac{\\pi}{4}$.', verify: { kind: 'roots', f: 'atan(2*x)+atan(3*x)-pi/4', answers: ['1/6'] } }
    ],
    diagrams: [
      {
        title: 'Two angles with the same sine',
        spec: { kind: 'unitCircleDrag', initial: 150 },
        note: 'At $150^\\circ$ the sine is $\\tfrac12$, the same as at $30^\\circ$. Only $30^\\circ$ lies in $[-90^\\circ,90^\\circ]$, so $\\sin^{-1}\\tfrac12=\\tfrac{\\pi}{6}$. Drag the point through the left half of the circle and watch every sine there repeat one from the right half.'
      },
      {
        title: 'The principal branch of $\\sin x$ and its inverse',
        spec: {
          kind: 'plane', xmin: -2, xmax: 2, ymin: -2, ymax: 2,
          curves: [{ expr: 'sin(x)', domain: [-HALF_PI, HALF_PI], label: 'y=\\sin x' }, { expr: 'asin(x)', domain: [-1, 1], label: 'y=\\sin^{-1}x' }],
          lines: [{ through: [[0, 0], [1, 1]], label: 'y=x' }],
          points: [{ x: 1, y: HALF_PI, label: '\\left(1,\\tfrac{\\pi}{2}\\right)', pos: 'nw' }, { x: HALF_PI, y: 1, label: '\\left(\\tfrac{\\pi}{2},1\\right)', pos: 'se' }]
        },
        note: 'Restricted to $\\left[-\\tfrac{\\pi}{2},\\tfrac{\\pi}{2}\\right]$, sine ends at $\\left(\\tfrac{\\pi}{2},1\\right)$. Its inverse is the mirror image in $y=x$, so it ends at $\\left(1,\\tfrac{\\pi}{2}\\right)$: the domain of $\\sin^{-1}$ is $[-1,1]$ and its range is $\\left[-\\tfrac{\\pi}{2},\\tfrac{\\pi}{2}\\right]$.'
      },
      {
        title: 'The graph of $y=\\sin^{-1}(\\sin x)$',
        spec: { kind: 'function', xmin: -7, xmax: 7, ymin: -2, ymax: 2, curves: [{ expr: 'asin(sin(x))', label: 'y=\\sin^{-1}(\\sin x)' }], points: [{ x: 2 * Math.PI / 3, y: Math.PI / 3, label: '\\left(\\tfrac{2\\pi}{3},\\tfrac{\\pi}{3}\\right)' }] },
        note: 'The graph follows $y=x$ only for $-\\tfrac{\\pi}{2}\\le x\\le\\tfrac{\\pi}{2}$, then turns down. At $x=\\tfrac{2\\pi}{3}$ it gives $\\tfrac{\\pi}{3}$, the angle in the principal range with the same sine. The output never leaves $\\left[-\\tfrac{\\pi}{2},\\tfrac{\\pi}{2}\\right]$.'
      }
    ]
  },

  'c12-matrices': {
    objective: 'Add, multiply and transpose matrices, and find the inverse of a square matrix by elementary row operations.',
    intuition: 'A $2\\times2$ matrix moves every point of the plane: it sends $(1,0)$ to its first column and $(0,1)$ to its second, and every other point follows. The product $AB$ means "do $B$, then $A$", which is why the order matters and why $AB$ and $BA$ usually differ. An inverse is the matrix that undoes the move, and it exists only when the move has not flattened the plane onto a line.',
    check: [
      { question: 'Find $A^2$ for $A=\\begin{pmatrix}2&-1\\\\3&4\\end{pmatrix}$.', answer: '$A^2=\\begin{pmatrix}1&-6\\\\18&13\\end{pmatrix}$', verify: { kind: 'values', pairs: [['2*2+(-1)*3', '1'], ['2*(-1)+(-1)*4', '-6'], ['3*2+4*3', '18'], ['3*(-1)+4*4', '13']] } },
      { question: 'For $A=\\begin{pmatrix}1&2\\\\0&3\\end{pmatrix}$ and $B=\\begin{pmatrix}2&0\\\\1&1\\end{pmatrix}$, find $AB$ and $BA$.', answer: '$AB=\\begin{pmatrix}4&2\\\\3&3\\end{pmatrix}$ and $BA=\\begin{pmatrix}2&4\\\\1&5\\end{pmatrix}$, so $AB\\ne BA$', verify: { kind: 'values', pairs: [['1*2+2*1', '4'], ['1*0+2*1', '2'], ['0*2+3*1', '3'], ['0*0+3*1', '3'], ['2*1+0*0', '2'], ['2*2+0*3', '4'], ['1*1+1*0', '1'], ['1*2+1*3', '5']] } },
      { question: 'For $A=\\begin{pmatrix}3&1\\\\-1&2\\end{pmatrix}$, find $k$ so that $A^2-5A+kI=O$, and use it to write $A^{-1}$.', answer: '$k=7$. Then $A(5I-A)=7I$, so $A^{-1}=\\tfrac17(5I-A)=\\tfrac17\\begin{pmatrix}2&-1\\\\1&3\\end{pmatrix}$.', verify: { kind: 'values', pairs: [['(3*3+1*(-1))-5*3+7', '0'], ['(3*1+1*2)-5*1', '0'], ['((-1)*1+2*2)-5*2+7', '0'], ['(3*2+1*1)/7', '1'], ['(3*(-1)+1*3)/7', '0'], ['((-1)*(-1)+2*3)/7', '1']] } }
    ],
    diagrams: [
      {
        title: 'Where $A=\\begin{pmatrix}2&1\\\\5&3\\end{pmatrix}$ sends the unit square',
        spec: { kind: 'matrixTransform', m: [[2, 1], [5, 3]] },
        note: '$A$ sends $(1,0)$ to $(2,5)$ and $(0,1)$ to $(1,3)$, its two columns. The unit square becomes a parallelogram of area $|2\\cdot3-1\\cdot5|=1$, so nothing is flattened and $A$ can be undone by $A^{-1}=\\begin{pmatrix}3&-1\\\\-5&2\\end{pmatrix}$. Change an entry and watch the image square change with it.'
      },
      {
        title: 'Reflect in the $x$-axis, then rotate: $PQ$',
        spec: { kind: 'matrix2d', m: [[0, 1], [1, 0]] },
        note: 'With $Q=\\begin{pmatrix}1&0\\\\0&-1\\end{pmatrix}$ (reflect in the $x$-axis) and $P=\\begin{pmatrix}0&-1\\\\1&0\\end{pmatrix}$ (rotate $90^\\circ$), doing $Q$ first gives $PQ=\\begin{pmatrix}0&1\\\\1&0\\end{pmatrix}$: a reflection in $y=x$.'
      },
      {
        title: 'Rotate, then reflect in the $x$-axis: $QP$',
        spec: { kind: 'matrix2d', m: [[0, -1], [-1, 0]] },
        note: 'In the other order, $QP=\\begin{pmatrix}0&-1\\\\-1&0\\end{pmatrix}$: a reflection in $y=-x$. The same two moves in a different order give a different result, which is what $PQ\\ne QP$ means.'
      }
    ]
  },

  'c12-determinants': {
    objective: 'Evaluate a determinant, use it to decide whether a matrix is invertible, find the inverse through the adjoint, and solve a system of linear equations by $X=A^{-1}B$.',
    intuition: 'The determinant of a $2\\times2$ matrix is the area of the parallelogram that the unit square becomes, with a minus sign when the move flips the square over. For a $3\\times3$ matrix it is the signed volume of the image of the unit cube. A zero determinant means the plane has been squashed onto a line (or space onto a plane), so different points land on the same image and nothing can undo it. That is also why a system $AX=B$ with $|A|=0$ has either no solution or infinitely many.',
    check: [
      { question: 'For which value of $k$ does $\\begin{pmatrix}k&4\\\\3&6\\end{pmatrix}$ have no inverse?', answer: '$k=2$, since the determinant $6k-12$ is then $0$', verify: { kind: 'roots', f: '6*x-12', answers: ['2'] } },
      { question: 'Find the area of the triangle with vertices $(1,2)$, $(4,6)$ and $(7,3)$.', answer: '$\\dfrac{21}{2}$ square units', verify: { kind: 'value', expr: '0.5*abs(1*(6-3)+4*(3-2)+7*(2-6))', answer: '21/2' } },
      { question: '$A$ is a $3\\times3$ matrix with $|A|=3$. Find $|\\operatorname{adj}(2A)|$.', answer: '$576$, since $|2A|=2^3\\cdot3=24$ and $|\\operatorname{adj}M|=|M|^{2}$ for order $3$', verify: { kind: 'value', expr: '(2^3*3)^2', answer: '576' } }
    ],
    diagrams: [
      {
        title: 'The determinant as an area',
        spec: { kind: 'matrixTransform', m: [[3, 1], [1, 2]] },
        note: 'The columns $(3,1)$ and $(1,2)$ are the sides of the image of the unit square, with area $3\\cdot2-1\\cdot1=5$. Change the entries to $\\begin{pmatrix}2&4\\\\1&2\\end{pmatrix}$: the columns $(2,1)$ and $(4,2)$ point the same way, the parallelogram flattens to a segment, the determinant is $0$ and no inverse exists.'
      },
      {
        title: 'A triangle from its vertices',
        spec: { kind: 'plane', xmin: -1, xmax: 7, ymin: -1, ymax: 7, polygons: [{ points: [[1, 1], [5, 2], [3, 6]], shade: true }], points: [{ x: 1, y: 1, label: '(1,\\,1)', pos: 'sw' }, { x: 5, y: 2, label: '(5,\\,2)', pos: 'e' }, { x: 3, y: 6, label: '(3,\\,6)', pos: 'n' }] },
        note: 'With vertices $(1,1)$, $(5,2)$ and $(3,6)$ the determinant formula gives $\\tfrac12\\left|1(2-6)+5(6-1)+3(1-2)\\right|=\\tfrac12|18|=9$ square units. Had the three points been on one line, the determinant would have been $0$.'
      },
      {
        title: 'When $|A|=0$: parallel lines',
        spec: { kind: 'plane', xmin: -1, xmax: 6, ymin: -1, ymax: 4, equal: false, lines: [{ through: [[0, 2], [4, 0]], label: 'x+2y=4' }, { through: [[1, 2], [5, 0]], label: '2x+4y=10' }] },
        note: 'For $x+2y=4$ and $2x+4y=10$ the coefficient matrix $\\begin{pmatrix}1&2\\\\2&4\\end{pmatrix}$ has determinant $4-4=0$. The lines are parallel, so the system has no solution. With $2x+4y=8$ instead, the lines would coincide and there would be infinitely many.'
      }
    ]
  },

  'c12-continuity-differentiability': {
    objective: 'Test a function for continuity and differentiability at a point, and differentiate composite, implicit, inverse trigonometric, logarithmic and parametric functions.',
    intuition: 'Continuous at $x=a$ means the graph can be drawn through $x=a$ without lifting the pen: the left limit, the right limit and the value $f(a)$ all agree. Differentiable asks for more. Zoom in on the point and the graph should look like one straight line, so the slopes from the left and from the right settle on the same number. A corner, like $|x|$ at $0$, is continuous, but the two sides settle on slopes $-1$ and $1$, so there is no single tangent.',
    check: [
      { question: '$f(x)=kx^2$ for $x\\le2$ and $f(x)=3$ for $x>2$. Find $k$ so that $f$ is continuous at $x=2$.', answer: '$k=\\tfrac34$', verify: { kind: 'roots', f: '4*x-3', answers: ['3/4'] } },
      { question: 'If $x=t^2$ and $y=t^3$, find $\\dfrac{dy}{dx}$ at $t=2$.', answer: '$3$, since $\\dfrac{dy}{dx}=\\dfrac{3t^2}{2t}=\\dfrac{3t}{2}$', verify: { kind: 'value', expr: '3*2^2/(2*2)', answer: '3' } },
      { question: '$f(x)=ax^2+b$ for $x\\le1$ and $f(x)=4x-1$ for $x>1$. Find $a$ and $b$ so that $f$ is differentiable at $x=1$.', answer: '$a=2$, $b=1$. Equal slopes give $2a=4$; continuity gives $a+b=3$.', verify: { kind: 'values', pairs: [['2*2*1', '4'], ['2*1^2+1', '4*1-1']] } }
    ],
    diagrams: [
      {
        title: 'A jump at $x=2$',
        spec: { kind: 'plane', xmin: -1, xmax: 4, ymin: -1, ymax: 12, equal: false, curves: [{ expr: 'x+1', domain: [-1, 2], label: 'y=x+1' }, { expr: '3*x-1', domain: [2, 4], label: 'y=3x-1' }], points: [{ x: 2, y: 3, label: '(2,\\,3)', pos: 'se' }, { x: 2, y: 5, label: '(2,\\,5)', pos: 'nw' }] },
        note: 'The left piece $x+1$ arrives at $(2,3)$ and the right piece $3x-1$ leaves from $(2,5)$. The left limit $3$ and the right limit $5$ differ, so this function is not continuous at $x=2$, whatever value $f(2)$ is given.'
      },
      {
        title: 'Corners of $y=|x^2-a|$',
        spec: { kind: 'paramGraph', expr: 'abs(x^2-a)', params: [{ name: 'a', min: -2, max: 4, step: 1, initial: 4 }], xmin: -4, xmax: 4, ymin: -1, ymax: 8, show: ['roots'] },
        note: 'With $a=4$ the part of $x^2-4$ below the axis is folded up, making corners at $x=-2$ and $x=2$. At $x=2$ the slope from the left is $-4$ and from the right is $4$, so the function is continuous there but not differentiable. Slide $a$ to $0$ or below: $x^2-a$ never goes negative, nothing is folded, and the corners disappear.'
      }
    ]
  },

  'c12-applications-derivatives': {
    objective: 'Use the derivative to find rates of change, the intervals on which a function increases or decreases, tangents and normals, and local and absolute maxima and minima.',
    intuition: 'The sign of $f\'(x)$ tells you which way the graph is heading: positive means rising, negative means falling. A local maximum is where the graph stops rising and starts falling, so $f\'$ changes from positive to negative through $0$ there. On a closed interval the largest value is at such a turning point or at an end of the interval, which is why the method checks both.',
    check: [
      { question: 'Find the interval on which $f(x)=x^3-12x+5$ is decreasing.', answer: '$(-2,2)$, where $f\'(x)=3x^2-12<0$', verify: { kind: 'roots', f: '3*x^2-12', answers: ['-2', '2'] } },
      { question: 'Find the equation of the normal to $y=x^2+3$ at $(1,4)$.', answer: '$x+2y=9$, since the tangent slope is $2$ and the normal slope is $-\\tfrac12$', verify: { kind: 'equivalent', a: '(9-x)/2', b: '4-(x-1)/2' } },
      { question: 'An open box with a square base is to hold $32\\text{ cm}^3$. Find the least possible area of sheet metal.', answer: '$48\\text{ cm}^2$, with base side $4$ cm and height $2$ cm. The area is $S=x^2+\\dfrac{128}{x}$, and $S\'(x)=2x-\\dfrac{128}{x^2}=0$ at $x=4$.', verify: { kind: 'values', pairs: [['2*4-128/4^2', '0'], ['4^2+128/4', '48'], ['32/4^2', '2']] } }
    ],
    diagrams: [
      {
        title: 'Turning points of $y=x^3-6x^2+ax$',
        spec: { kind: 'paramGraph', expr: 'x^3-6*x^2+a*x', params: [{ name: 'a', min: 8, max: 15, step: 1, initial: 9 }], xmin: -1, xmax: 5, ymin: -6, ymax: 12, show: ['turning'] },
        note: 'With $a=9$, $f\'(x)=3x^2-12x+9=3(x-1)(x-3)$: a local maximum $4$ at $x=1$ and a local minimum $0$ at $x=3$. Raise $a$ and the two turning points close in; at $a=12$ they merge at $x=2$, and beyond that $f\'(x)>0$ everywhere, so $f$ increases on all of $\\mathbb R$.'
      },
      {
        title: 'Absolute extrema of $x^3-3x$ on $[0,2]$',
        spec: { kind: 'function', xmin: -1, xmax: 3, ymin: -3, ymax: 3, curves: [{ expr: 'x^3-3*x', label: 'y=x^3-3x' }], points: [{ x: 0, y: 0, label: '(0,\\,0)' }, { x: 1, y: -2, label: '(1,\\,-2)' }, { x: 2, y: 2, label: '(2,\\,2)' }] },
        note: 'On $[0,2]$ the only stationary point is $x=1$, where $f=-2$. The ends give $f(0)=0$ and $f(2)=2$. So the absolute minimum $-2$ is at a turning point, and the absolute maximum $2$ is at an end of the interval, where $f\'$ is not zero.'
      }
    ]
  },

  'c12-integrals': {
    objective: 'Find indefinite integrals by standard results, substitution, partial fractions and integration by parts, and evaluate definite integrals with the fundamental theorem and the properties of definite integrals.',
    intuition: 'An indefinite integral answers "which function has this derivative?", so every answer can be checked by differentiating it. A definite integral starts as something else: the limit of sums of thin strips $f(x)\\,\\Delta x$. The fundamental theorem joins the two. The area function $A(x)=\\int_a^x f(t)\\,dt$ grows at the rate $f(x)$, so it is an antiderivative of $f$, and the total from $a$ to $b$ is $F(b)-F(a)$ for any antiderivative $F$.',
    check: [
      { question: 'Evaluate $\\int_1^2(3x^2-2x)\\,dx$.', answer: '$4$, since $\\left[x^3-x^2\\right]_1^2=4-0$', verify: { kind: 'value', expr: '(2^3-2^2)-(1^3-1^2)', answer: '4' } },
      { question: 'Find $\\displaystyle\\int\\frac{dx}{(x-1)(x+2)}$.', answer: '$\\dfrac13\\ln\\left|\\dfrac{x-1}{x+2}\\right|+C$, from $\\dfrac{1}{(x-1)(x+2)}=\\dfrac13\\left(\\dfrac{1}{x-1}-\\dfrac{1}{x+2}\\right)$', verify: { kind: 'equivalent', a: '(1/3)*(1/(x-1)-1/(x+2))', b: '1/((x-1)*(x+2))' } },
      { question: 'Evaluate $\\displaystyle\\int_0^{\\pi/2}\\frac{\\sin x}{\\sin x+\\cos x}\\,dx$.', answer: '$\\dfrac{\\pi}{4}$. Replacing $x$ by $\\tfrac{\\pi}{2}-x$ turns the integral $I$ into $\\int_0^{\\pi/2}\\frac{\\cos x}{\\cos x+\\sin x}\\,dx$; adding the two forms gives $2I=\\tfrac{\\pi}{2}$.', verify: { kind: 'value', expr: 'sum((pi/2/2000)*sin((k-0.5)*pi/4000)/(sin((k-0.5)*pi/4000)+cos((k-0.5)*pi/4000)),k,1,2000)', answer: 'pi/4' } }
    ],
    diagrams: [
      {
        title: 'Rectangles under $y=\\dfrac{1}{1+x^2}$ from $0$ to $1$',
        spec: { kind: 'riemannSlider', expr: '1/(1+x^2)', a: 0, b: 1, initialN: 4 },
        note: 'The exact area is $\\tan^{-1}1=\\tfrac{\\pi}{4}\\approx0.785$. Four left-endpoint rectangles give about $0.845$, too much because the curve falls. Increase $n$ and the sum closes in on $0.785$: the definite integral is the limit of these sums.'
      },
      {
        title: 'An odd function on $[-2,2]$',
        spec: { kind: 'function', xmin: -3, xmax: 3, ymin: -9, ymax: 9, curves: [{ expr: 'x^3', label: 'y=x^3', shade: { from: -2, to: 2 } }], points: [{ x: -2, y: -8, label: '(-2,\\,-8)' }, { x: 2, y: 8, label: '(2,\\,8)' }] },
        note: 'The piece from $0$ to $2$ has area $\\int_0^2x^3\\,dx=4$ above the axis, and the piece from $-2$ to $0$ is its image under a half-turn, $4$ below. They cancel, so $\\int_{-2}^{2}x^3\\,dx=0$ without any working: for odd $f$, $\\int_{-a}^{a}f(x)\\,dx=0$.'
      }
    ]
  },

  'c12-applications-integrals': {
    objective: 'Find the area bounded by a curve and an axis, or between two curves, by sketching the region, finding where the boundaries meet and integrating the upper boundary minus the lower.',
    intuition: 'Slice the region into thin vertical strips. A strip at $x$ has height (upper curve minus lower curve) and width $dx$, so its area is about $\\big(f(x)-g(x)\\big)\\,dx$, and the integral adds the strips from the left edge of the region to the right. The limits are where the boundaries meet, which is why the sketch and the intersection points come before any integration. When the region is easier to slice sideways, use horizontal strips and integrate in $y$.',
    check: [
      { question: 'Find the area bounded by $y=4-x^2$ and the $x$-axis.', answer: '$\\dfrac{32}{3}$ square units', verify: { kind: 'value', expr: '2*(4*2-2^3/3)', answer: '32/3' } },
      { question: 'Find the area enclosed by $y=x^2$ and $y=2x$.', answer: '$\\dfrac43$ square units, from $\\int_0^2(2x-x^2)\\,dx$', verify: { kind: 'value', expr: '2^2-2^3/3', answer: '4/3' } },
      { question: 'Find the area enclosed by the parabola $y^2=4x$ and the line $y=2x-4$.', answer: '$9$ square units. They meet at $(1,-2)$ and $(4,4)$; with horizontal strips the area is $\\int_{-2}^{4}\\left(\\dfrac{y+4}{2}-\\dfrac{y^2}{4}\\right)dy$.', verify: { kind: 'value', expr: '(4^2/4+2*4-4^3/12)-((-2)^2/4+2*(-2)-(-2)^3/12)', answer: '9' } }
    ],
    diagrams: [
      {
        title: 'The region between $y=x+2$ and $y=x^2$',
        spec: { kind: 'plane', xmin: -2, xmax: 3, ymin: -1, ymax: 5, curves: [{ expr: 'x^2', label: 'y=x^2' }, { expr: 'x+2', label: 'y=x+2' }], polygons: [{ points: BETWEEN_LINE_AND_PARABOLA, shade: true }], points: [{ x: -1, y: 1, label: '(-1,\\,1)', pos: 'w' }, { x: 2, y: 4, label: '(2,\\,4)', pos: 'e' }] },
        note: 'The line lies above the parabola between their meeting points $(-1,1)$ and $(2,4)$. A strip at $x$ has height $x+2-x^2$, so the shaded area is $\\int_{-1}^{2}(x+2-x^2)\\,dx=\\tfrac92$ square units.'
      },
      {
        title: 'The same area as a sum of strips',
        spec: { kind: 'riemannSlider', expr: 'x+2-x^2', a: -1, b: 2, initialN: 6 },
        note: 'Each rectangle here is one strip of the region above, standing on the axis: its height is the gap $x+2-x^2$ between the two curves. Increase $n$ and the total approaches $\\tfrac92=4.5$.'
      },
      {
        title: 'The ellipse $\\dfrac{x^2}{9}+\\dfrac{y^2}{4}=1$',
        spec: { kind: 'plane', xmin: -4, xmax: 4, ymin: -3, ymax: 3, param: [{ x: '3*cos(t)', y: '2*sin(t)', t: [0, 2 * Math.PI] }], points: [{ x: 3, y: 0, label: '(3,\\,0)', pos: 'ne' }, { x: 0, y: 2, label: '(0,\\,2)', pos: 'ne' }] },
        note: 'The quarter in the first quadrant is $\\int_0^3\\tfrac23\\sqrt{9-x^2}\\,dx=\\tfrac{3\\pi}{2}$. By symmetry the whole ellipse has area $4\\cdot\\tfrac{3\\pi}{2}=6\\pi\\approx18.85$ square units, which is $\\pi ab$ with $a=3$, $b=2$.'
      }
    ]
  },

  'c12-differential-equations': {
    objective: 'Find the order and degree of a differential equation, and solve first-order equations that are variables separable, homogeneous or linear.',
    intuition: 'An equation $\\dfrac{dy}{dx}=f(x,y)$ gives the slope of the solution at every point of the plane. Draw a short dash with that slope at many points and the solutions appear as curves that follow the dashes. The general solution is the whole family of these curves, one through each starting point. An initial condition such as $y(0)=2$ picks out the single curve through $(0,2)$, which is why it fixes the constant.',
    check: [
      { question: 'Solve $\\dfrac{dy}{dx}=3x^2y$ with $y(0)=5$, and find $y(1)$.', answer: '$y=5e^{x^3}$, so $y(1)=5e$', verify: { kind: 'value', expr: '5*exp(1^3)', answer: '5*e' } },
      { question: 'Solve $\\dfrac{dy}{dx}+2y=4$ with $y(0)=0$, and find $y$ when $x=\\ln2$.', answer: '$y=2-2e^{-2x}$, so $y(\\ln2)=\\tfrac32$', verify: { kind: 'value', expr: '2-2*exp(-2*ln(2))', answer: '3/2' } },
      { question: 'Solve $2xy\\,\\dfrac{dy}{dx}=x^2+y^2$ for the curve through $(1,0)$.', answer: '$x^2-y^2=x$. With $y=vx$ the equation separates as $\\dfrac{2v\\,dv}{1-v^2}=\\dfrac{dx}{x}$, giving $x(1-v^2)=C$, that is $x^2-y^2=Cx$, and $(1,0)$ gives $C=1$.', verify: { kind: 'equivalent', a: '(2*x-1)/(2*sqrt(x^2-x))', b: '(x^2+(x^2-x))/(2*x*sqrt(x^2-x))' } }
    ],
    diagrams: [
      {
        title: 'Solutions of $\\dfrac{dy}{dx}=xy$',
        spec: { kind: 'slopeFieldExplorer', dydx: 'x*y', xmin: -2, xmax: 2, ymin: -4, ymax: 8, through: [[0, 2]] },
        note: 'Through $(0,2)$ the solution is $y=2e^{x^2/2}$, which is $2e^{1/2}\\approx3.30$ at $x=\\pm1$. Move the starting point below the axis and the curve flips over: $y=Ce^{x^2/2}$ with $C<0$. Start on the axis and the solution is $y=0$ itself, where every dash is flat.'
      },
      {
        title: 'Solutions of $\\dfrac{dy}{dx}+y=e^x$',
        spec: { kind: 'slopeField', dydx: 'exp(x)-y', xmin: -2, xmax: 2, ymin: -2, ymax: 4, through: [[0, 0.5], [0, 1.5], [0, -0.5]] },
        note: 'The general solution is $y=\\tfrac12e^{x}+Ce^{-x}$. The curve through $\\left(0,\\tfrac12\\right)$ has $C=0$ and is exactly $y=\\tfrac12e^{x}$. The curves through $\\left(0,\\tfrac32\\right)$ and $\\left(0,-\\tfrac12\\right)$ have $C=1$ and $C=-1$, and both approach it as $x$ grows, because $Ce^{-x}\\to0$.'
      }
    ]
  },

  'c12-vector-algebra': {
    objective: 'Write vectors in components, add and scale them, and use the dot and cross products to find angles, projections, perpendicular directions and areas.',
    intuition: 'The dot product measures how much two vectors point the same way. $\\vec a\\cdot\\vec b=|\\vec a||\\vec b|\\cos\\theta$ is positive for an acute angle, zero for a right angle and negative for an obtuse one, and dividing by $|\\vec b|$ gives the length of the shadow of $\\vec a$ on the line of $\\vec b$. The cross product measures how much they point apart: its length $|\\vec a||\\vec b|\\sin\\theta$ is the area of the parallelogram they span, and its direction is perpendicular to both.',
    check: [
      { question: 'Find $\\lambda$ so that $2\\hat i+\\lambda\\hat j+\\hat k$ is perpendicular to $\\hat i-2\\hat j+3\\hat k$.', answer: '$\\lambda=\\tfrac52$, from $2-2\\lambda+3=0$', verify: { kind: 'roots', f: '2-2*x+3', answers: ['5/2'] } },
      { question: 'Find the projection of $\\vec a=2\\hat i+3\\hat j+2\\hat k$ on $\\vec b=\\hat i+2\\hat j+\\hat k$.', answer: '$\\dfrac{10}{\\sqrt6}=\\dfrac{5\\sqrt6}{3}$', verify: { kind: 'value', expr: '(2+6+2)/sqrt(6)', answer: '5*sqrt(6)/3' } },
      { question: 'The diagonals of a parallelogram are $3\\hat i+\\hat j-2\\hat k$ and $\\hat i-3\\hat j+4\\hat k$. Find its area.', answer: '$5\\sqrt3$ square units. The cross product of the diagonals is $-2\\hat i-14\\hat j-10\\hat k$, of length $10\\sqrt3$, and the area is half of that.', verify: { kind: 'value', expr: '0.5*sqrt((1*4-(-2)*(-3))^2+((-2)*1-3*4)^2+(3*(-3)-1*1)^2)', answer: '5*sqrt(3)' } }
    ],
    diagrams: [
      {
        title: 'The projection of $\\vec a$ on $\\vec b$',
        spec: { kind: 'vectorExplorer', a: [4, 1], b: [2, 2], mode: 'projection' },
        note: 'With $\\vec a=4\\hat i+\\hat j$ and $\\vec b=2\\hat i+2\\hat j$, $\\vec a\\cdot\\vec b=10$ and the shadow of $\\vec a$ on $\\vec b$ has length $\\tfrac{10}{2\\sqrt2}\\approx3.54$; the angle between them is about $31^\\circ$. Move $\\vec a$ until it is perpendicular to $\\vec b$: the dot product and the projection both fall to $0$.'
      },
      {
        title: 'The triangle law',
        spec: { kind: 'vector', vectors: [{ dx: 3, dy: 1, label: '\\vec a' }, { dx: 1, dy: 2, label: '\\vec b' }], resultant: true },
        note: 'Placed tip to tail, $\\vec a=3\\hat i+\\hat j$ and $\\vec b=\\hat i+2\\hat j$ give $\\vec a+\\vec b=4\\hat i+3\\hat j$, of length $\\sqrt{16+9}=5$. Components add separately, which is all the triangle law says.'
      },
      {
        title: '$\\vec a\\times\\vec b$ is perpendicular to both',
        spec: { kind: 'space3d', points: [{ x: 1, y: 2, z: 3, label: 'A' }, { x: 2, y: -1, z: 1, label: 'B' }], vectors: [{ from: [0, 0, 0], to: [1, 2, 3], label: '\\vec a' }, { from: [0, 0, 0], to: [2, -1, 1], label: '\\vec b' }, { from: [0, 0, 0], to: [5, 5, -5], label: '\\vec a\\times\\vec b' }] },
        note: 'For $\\vec a=\\hat i+2\\hat j+3\\hat k$ and $\\vec b=2\\hat i-\\hat j+\\hat k$, $\\vec a\\times\\vec b=5\\hat i+5\\hat j-5\\hat k$. It is perpendicular to $\\vec a$, since $5+10-15=0$, and to $\\vec b$, since $10-5-5=0$. Its length $5\\sqrt3$ is the area of the parallelogram on $\\vec a$ and $\\vec b$; the triangle is half, $\\tfrac{5\\sqrt3}{2}$.'
      }
    ]
  },

  'c12-3d-geometry': {
    objective: 'Write the equations of lines and planes in space, and find the angles between them, the shortest distance between two skew lines and the distance from a point to a plane.',
    intuition: 'A line in space is a starting point and a direction: $\\vec r=\\vec a+\\lambda\\vec b$ walks along $\\vec b$ from $\\vec a$. A plane is fixed by one point and one normal: every vector lying in the plane is perpendicular to $\\vec n$, and that is the whole content of $\\vec n\\cdot(\\vec r-\\vec a)=0$. Distances are measured along perpendiculars, so they come from projecting onto a normal. For two skew lines the common normal is $\\vec b_1\\times\\vec b_2$.',
    check: [
      { question: 'Find the direction cosines of the line $\\dfrac{x-1}{2}=\\dfrac{y+3}{-1}=\\dfrac{z}{2}$.', answer: '$\\tfrac23,\\ -\\tfrac13,\\ \\tfrac23$', verify: { kind: 'values', pairs: [['2/sqrt(4+1+4)', '2/3'], ['-1/sqrt(4+1+4)', '-1/3'], ['2/sqrt(4+1+4)', '2/3']] } },
      { question: 'Find the angle between the planes $2x-y+z=6$ and $x+y+2z=7$.', answer: '$\\dfrac{\\pi}{3}$, since $\\cos\\theta=\\dfrac{|2-1+2|}{\\sqrt6\\sqrt6}=\\dfrac12$', verify: { kind: 'value', expr: 'acos(abs(2*1+(-1)*1+1*2)/(sqrt(6)*sqrt(6)))', answer: 'pi/3' } },
      { question: 'Find the image of the point $(1,3,4)$ in the plane $2x-y+z+3=0$.', answer: '$(-3,5,2)$. The perpendicular is $(1,3,4)+t(2,-1,1)$; the midpoint condition gives $t=-2$.', verify: { kind: 'values', pairs: [['1+2*(-2*(2*1-3+4+3)/6)', '-3'], ['3-(-2*(2*1-3+4+3)/6)', '5'], ['4+(-2*(2*1-3+4+3)/6)', '2']] } }
    ],
    diagrams: [
      {
        title: 'The distance from a point to a plane',
        spec: { kind: 'space3d', points: [{ x: 2, y: 1, z: -1, label: 'P' }, { x: 25 / 9, y: -5 / 9, z: 5 / 9, label: 'F' }], vectors: [{ from: [2, 1, -1], to: [25 / 9, -5 / 9, 5 / 9], label: 'd' }], planes: [{ n: [1, -2, 2], d: 5 }] },
        note: 'From $P(2,1,-1)$ the perpendicular to $x-2y+2z=5$ runs along $\\vec n=\\hat i-2\\hat j+2\\hat k$ and meets the plane at $F\\left(\\tfrac{25}{9},-\\tfrac59,\\tfrac59\\right)$. Its length is $\\tfrac79|\\vec n|=\\tfrac79\\cdot3=\\tfrac73$, the value the distance formula gives.'
      },
      {
        title: 'Two skew lines',
        spec: { kind: 'space3d', points: [{ x: 1, y: 1, z: 0, label: 'A_1' }, { x: 2, y: 1, z: -1, label: 'A_2' }], lines: [{ point: [1, 1, 0], dir: [2, -1, 1], label: 'L_1' }, { point: [2, 1, -1], dir: [3, -5, 2], label: 'L_2' }] },
        note: 'The directions $(2,-1,1)$ and $(3,-5,2)$ are not parallel and the lines never meet. Their common normal is $\\vec b_1\\times\\vec b_2=3\\hat i-\\hat j-7\\hat k$, of length $\\sqrt{59}$. Projecting $\\overrightarrow{A_1A_2}=\\hat i-\\hat k$ onto it gives the shortest distance $\\tfrac{10}{\\sqrt{59}}\\approx1.30$.'
      },
      {
        title: 'Distance from a point to a line, in one plane',
        spec: { kind: 'vectorExplorer', a: [1, 4], b: [3, 1], mode: 'projection' },
        note: 'Take $\\vec b=3\\hat i+\\hat j$ as the direction of a line through $A$, and $\\vec a=\\overrightarrow{AP}=\\hat i+4\\hat j$. The projection of $\\vec a$ on $\\vec b$ has length $\\tfrac{7}{\\sqrt{10}}$; what is left is the perpendicular from $P$ to the line, of length $\\tfrac{|\\vec a\\times\\vec b|}{|\\vec b|}=\\tfrac{11}{\\sqrt{10}}\\approx3.48$. The same formula works in space. Move $\\vec a$ and watch the two parts change.'
      }
    ]
  },

  'c12-linear-programming': {
    objective: 'Formulate a linear programming problem in two variables, draw its feasible region, and find the optimal value by the corner point method, including when the region is unbounded.',
    intuition: 'Each value of $Z=ax+by$ is a straight line, and all these lines are parallel. Raising $Z$ slides the line across the plane in one direction. The largest $Z$ that still touches the feasible region is where the sliding line is about to leave it, and the last point of contact with a polygon is a corner, or a whole edge when the line is parallel to that edge. That is why only the corners need to be checked.',
    check: [
      { question: 'Maximise $Z=2x+3y$ subject to $x+y\\le5$, $x\\le3$, $x\\ge0$, $y\\ge0$.', answer: '$Z_{\\max}=15$ at $(0,5)$. The corners $(0,0)$, $(3,0)$, $(3,2)$, $(0,5)$ give $Z=0,6,12,15$.', verify: { kind: 'values', pairs: [['2*3+3*0', '6'], ['2*3+3*2', '12'], ['2*0+3*5', '15']] } },
      { question: 'Minimise $Z=3x+5y$ subject to $x+3y\\ge3$, $x+y\\ge2$, $x\\ge0$, $y\\ge0$.', answer: '$Z_{\\min}=7$ at $\\left(\\tfrac32,\\tfrac12\\right)$. The corners give $Z=9$ at $(3,0)$, $7$ at $\\left(\\tfrac32,\\tfrac12\\right)$, $10$ at $(0,2)$, and the half-plane $3x+5y<7$ has no point in the region.', verify: { kind: 'values', pairs: [['3/2+3*(1/2)', '3'], ['3/2+1/2', '2'], ['3*(3/2)+5*(1/2)', '7']] } },
      { question: 'Maximise $Z=3x+6y$ subject to $x+2y\\le10$, $x+y\\le7$, $x\\ge0$, $y\\ge0$.', answer: '$Z_{\\max}=30$, at $(4,3)$, at $(0,5)$ and at every point of the edge joining them, because $Z$ is parallel to $x+2y=10$.', verify: { kind: 'values', pairs: [['3*4+6*3', '30'], ['3*0+6*5', '30'], ['3*7+6*0', '21']] } }
    ],
    diagrams: [
      {
        title: 'Slide the objective line across the region',
        spec: { kind: 'lpExplorer', constraints: [{ a: 1, b: 1, op: '<=', c: 4 }, { a: 1, b: 3, op: '<=', c: 6 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 7, ymin: -1, ymax: 5, objective: { a: 3, b: 2, goal: 'max' } },
        note: 'The corners are $(0,0)$, $(4,0)$, $(3,1)$ and $(0,2)$, where $Z=3x+2y$ is $0$, $12$, $11$ and $4$. Slide the line $3x+2y=Z$ outwards: the last point of the region it touches is $(4,0)$, so $Z_{\\max}=12$.'
      },
      {
        title: 'An unbounded feasible region',
        spec: { kind: 'region', constraints: [{ a: 1, b: 2, op: '>=', c: 4 }, { a: 3, b: 1, op: '>=', c: 6 }, { a: 1, b: 0, op: '>=', c: 0 }, { a: 0, b: 1, op: '>=', c: 0 }], xmin: -1, xmax: 7, ymin: -1, ymax: 8, objective: { a: 2, b: 3, goal: 'min' } },
        note: 'The corners are $(0,6)$, $\\left(\\tfrac85,\\tfrac65\\right)$ and $(4,0)$, where $Z=2x+3y$ is $18$, $\\tfrac{34}{5}$ and $8$. The region runs off without end, so check that $2x+3y<\\tfrac{34}{5}$ has no point in it: it has none, and $Z_{\\min}=\\tfrac{34}{5}$. $Z$ has no maximum here.'
      }
    ]
  },

  'c12-probability': {
    objective: 'Find conditional probabilities, decide whether two events are independent, use total probability and Bayes\u2019 theorem, and find the mean, variance and binomial probabilities of a random variable.',
    intuition: 'Knowing that $F$ has happened shrinks the sample space to $F$, and $P(E\\mid F)$ is the share of $F$ that also lies in $E$. A probability tree shows this at a glance. Multiply along a branch for the chance of that path; add the paths that end in the observed result for its total probability. Bayes\u2019 theorem is one path\u2019s share of that total.',
    check: [
      { question: '$P(A)=0.6$, $P(B)=0.5$ and $P(A\\cap B)=0.3$. Find $P(A\\mid B)$ and decide whether $A$ and $B$ are independent.', answer: '$P(A\\mid B)=0.6=P(A)$, so they are independent', verify: { kind: 'values', pairs: [['0.3/0.5', '0.6'], ['0.6*0.5', '0.3']] } },
      { question: '$X$ takes the values $0$, $1$, $2$ with probabilities $0.2$, $0.5$, $0.3$. Find its mean and variance.', answer: 'Mean $1.1$, variance $1.7-1.21=0.49$', verify: { kind: 'values', pairs: [['0*0.2+1*0.5+2*0.3', '1.1'], ['(0*0.2+1*0.5+4*0.3)-1.1^2', '0.49']] } },
      { question: 'A test detects a disease in $95\\%$ of people who have it and wrongly shows positive for $2\\%$ of people who do not. If $1\\%$ of people have the disease, find the probability that a person who tests positive has it.', answer: '$\\dfrac{95}{293}\\approx0.32$', verify: { kind: 'value', expr: '0.01*0.95/(0.01*0.95+0.99*0.02)', answer: '95/293' } }
    ],
    diagrams: [
      {
        title: 'Choose a bag, then draw a ball',
        spec: { kind: 'tree', branches: [{ label: 'Bag I', p: [1, 2], children: [{ label: 'R', p: [3, 5] }, { label: 'B', p: [2, 5] }] }, { label: 'Bag II', p: [1, 2], children: [{ label: 'R', p: [1, 3] }, { label: 'B', p: [2, 3] }] }] },
        note: 'Red can happen two ways: $\\tfrac12\\cdot\\tfrac35=\\tfrac{3}{10}$ through bag I and $\\tfrac12\\cdot\\tfrac13=\\tfrac16$ through bag II, so $P(R)=\\tfrac{7}{15}$. Bayes\u2019 theorem is the first path\u2019s share: $P(\\text{I}\\mid R)=\\tfrac{3/10}{7/15}=\\tfrac{9}{14}$.'
      },
      {
        title: 'The binomial distribution $B(n,p)$',
        spec: { kind: 'binomialExplorer', n: 6, p: 0.5, highlight: [4] },
        note: 'With $n=6$ and $p=\\tfrac12$, $P(X=4)=\\binom64\\left(\\tfrac12\\right)^6=\\tfrac{15}{64}\\approx0.234$, the mean is $3$ and the variance $\\tfrac32$. Move $p$ to $0.8$ and the tallest bar moves to $X=5$; the mean becomes $4.8$ and the variance $0.96$.'
      }
    ]
  }
};
