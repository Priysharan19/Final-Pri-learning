// Pri Learning · NSW Notes · Experience 3 layer (ext2), see notes/e3.js. Original writing, en-AU.
// Every number below was computed (engine or SymPy), and every diagram uses the chapter's own numbers.
export default {
  'me2-12-01': {
    objective: 'Write the negation, converse and contrapositive of a statement, and prove results by direct argument, by contradiction, by mathematical induction and from the standard inequalities.',
    intuition: 'A proof is a chain in which every link follows from the ones before it, so a single gap breaks the whole argument. Induction works like a row of dominoes: show the first one falls, and that each one falling knocks over the next. Many inequalities come from one fact, that a square is never negative, and a semicircle shows why the arithmetic mean is never less than the geometric mean.',
    diagrams: [
      {
        title: 'The arithmetic and geometric means in a semicircle',
        spec: {
          kind: 'plane', xmin: -1, xmax: 14, ymin: -1, ymax: 8, axes: false, grid: false,
          points: [
            { x: 0, y: 0, label: 'A', pos: 'sw' }, { x: 4, y: 0, label: 'P', pos: 's' }, { x: 6.5, y: 0, label: 'O', pos: 's' },
            { x: 13, y: 0, label: 'B', pos: 'se' }, { x: 4, y: 6, label: 'Q', pos: 'nw' }
          ],
          segments: [
            { from: [0, 0], to: [4, 0], label: 'a' }, { from: [4, 0], to: [13, 0], label: 'b' },
            { from: [4, 0], to: [4, 6], label: '\\sqrt{ab}' }, { from: [6.5, 0], to: [6.5, 6.5], label: '\\tfrac{a+b}{2}', dashed: true },
            { from: [0, 0], to: [4, 6] }, { from: [4, 6], to: [13, 0] }
          ],
          arcs: [{ cx: 6.5, cy: 0, r: 6.5, from: 0, to: 180 }],
          angles: [{ at: [4, 6], from: [0, 0], to: [13, 0], right: true }]
        },
        note: 'The diameter is split into $a=4$ and $b=9$. The radius is the arithmetic mean $\\tfrac{a+b}{2}=6.5$, and the half-chord $PQ$ is the geometric mean $\\sqrt{ab}=6$, from the similar triangles beside the right angle at $Q$. A half-chord can never be longer than the radius, so $\\tfrac{a+b}{2}\\ge\\sqrt{ab}$, with equality only when $a=b$.'
      },
      {
        title: 'Odd numbers add to square numbers',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 1, step: 2, n: 6 },
        note: 'The terms are $1,3,5,\\dots$ and the partial sums are $1,4,9,16,\\dots$. With $n=6$ the sum $1+3+\\cdots+11$ is $36=6^2$. Each new term $2k+1$ is exactly what turns $k^2$ into $(k+1)^2$: that is the inductive step.'
      }
    ]
  },
  'me2-12-02': {
    objective: 'Calculate with vectors in three dimensions, use the scalar product to find angles and projections, decide whether two lines in space meet, are parallel or are skew, and use the vector equation of a sphere.',
    intuition: 'A vector in space is a step with three components, and the rules from the plane carry over one component at a time. The scalar product measures how much two directions agree: it is largest when they point the same way and zero when they are at right angles. What is new in three dimensions is that two lines can miss each other without being parallel.',
    diagrams: [
      {
        title: 'Two lines in space meeting at $P$',
        spec: {
          kind: 'space3d',
          points: [{ x: 1, y: 0, z: 2, label: 'A' }, { x: 0, y: 1, z: 3, label: 'B' }, { x: 3, y: 4, z: 0, label: 'P' }],
          vectors: [{ from: [0, 0, 0], to: [3, 4, 0], label: '\\overrightarrow{OP}' }],
          lines: [{ point: [1, 0, 2], dir: [1, 2, -1], label: '\\ell_1' }, { point: [0, 1, 3], dir: [1, 1, -1], label: '\\ell_2' }]
        },
        note: 'The line through $A(1,0,2)$ with direction $(1,2,-1)$ and the line through $B(0,1,3)$ with direction $(1,1,-1)$ meet at $P(3,4,0)$, when $\\lambda=2$ and $\\mu=3$. Tilt either direction slightly and in general the lines would pass each other without meeting: they would be skew.'
      },
      {
        title: 'The projection of $\\mathbf a$ on $\\mathbf b$',
        spec: { kind: 'vectorExplorer', a: [3, 1], b: [1, 3], mode: 'projection' },
        note: 'With $\\mathbf a=(3,1)$ and $\\mathbf b=(1,3)$, $\\mathbf a\\cdot\\mathbf b=6$ and the scalar projection of $\\mathbf a$ on $\\mathbf b$ is $\\tfrac{6}{\\sqrt{10}}\\approx1.90$. Turn $\\mathbf b$ until it is perpendicular to $\\mathbf a$ and the projection shrinks to $0$. The same calculation works with three components.'
      }
    ]
  },
  'me2-12-03': {
    objective: 'Do arithmetic with complex numbers in Cartesian form, find the conjugate, modulus and argument, convert to modulus-argument form, and solve quadratic equations with complex roots.',
    intuition: 'Multiplying by $i$ turns a point on the Argand diagram through a right angle about the origin. Doing it twice turns it through $180^\\circ$, which is multiplying by $-1$, so $i^2=-1$ is a statement about rotation. In general, multiplying by $z$ scales by $|z|$ and rotates by $\\arg z$, which is why moduli multiply and arguments add.',
    diagrams: [
      {
        title: 'Complex roots come in conjugate pairs',
        spec: { kind: 'argand', points: [{ re: 2, im: 3, label: '2+3i' }, { re: 2, im: -3, label: '2-3i' }] },
        note: 'The roots of $z^2-4z+13=0$ are $2+3i$ and $2-3i$, reflections of each other in the real axis. Their sum is $4$ and their product is $4+9=13$, matching the coefficients of the quadratic.'
      },
      {
        title: 'Multiplying by a complex number',
        spec: { kind: 'argandExplorer', mode: 'multiply', points: [{ re: 3, im: 1, label: 'z' }], multiply: { re: 0, im: 1 } },
        note: 'Start with $z=3+i$ and multiply by $i$: the product $iz=-1+3i$ has the same modulus $\\sqrt{10}$ and is turned through $90^\\circ$. Change the multiplier and watch the modulus scale and the argument add.'
      }
    ]
  },
  'me2-12-04': {
    objective: 'Integrate by parts, by partial fractions and with the inverse trigonometric standard forms, and derive and use reduction formulae for definite integrals.',
    intuition: 'Each technique turns an integral you cannot do into one you can. Integration by parts is the product rule run backwards: it trades $\\int u\\,dv$ for $\\int v\\,du$, which is easier when differentiating $u$ simplifies it. Partial fractions split one hard fraction into several easy logarithms. A reduction formula makes the same trade repeatedly until only a known integral is left.',
    diagrams: [
      {
        title: 'The area under $y=\\ln x$ from $1$ to $e$',
        spec: {
          kind: 'function', xmin: 0, xmax: 4, ymin: -2, ymax: 2,
          curves: [{ expr: 'ln(x)', label: 'y=\\ln x', shade: { from: 1, to: Math.E } }],
          asymptotes: [{ x: 0 }]
        },
        note: 'Integration by parts with $u=\\ln x$ and $dv=dx$ gives $\\int\\ln x\\,dx=x\\ln x-x+C$. From $1$ to $e$ that is $(e-e)-(0-1)=1$, so the shaded area is exactly $1$.'
      }
    ]
  },
  'me2-12-05': {
    objective: 'Choose the right form of acceleration to set up and solve equations of motion for simple harmonic motion and for motion with resistance, and find a terminal velocity.',
    intuition: 'Acceleration says how the velocity is changing at each instant, so an equation of motion is an instruction for every possible state. For a falling body with $\\ddot x=g-kv$, the faster it falls the smaller its acceleration, until at $v=\\tfrac gk$ the acceleration is zero and the speed stops changing. Every starting speed is drawn towards that terminal velocity.',
    diagrams: [
      {
        title: 'Velocity against time with resistance',
        spec: { kind: 'slopeFieldExplorer', dydx: '10-0.5*y', xmin: 0, xmax: 12, ymin: 0, ymax: 24, through: [[0, 0]] },
        note: 'Each short segment shows $\\tfrac{dv}{dt}=10-0.5v$ at that time and speed, with $t$ across and $v$ up. From rest the solution climbs towards $v=20$, as in the first worked example. Start above $20$ and the body slows towards $20$ instead: the terminal velocity draws in every solution.'
      }
    ]
  }
};
