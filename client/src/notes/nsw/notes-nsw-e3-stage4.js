// Pri Learning · NSW Notes · Experience 3 layer (stage4), see notes/e3.js. Original writing, en-AU.
// Every number below was computed, not recalled; each diagram uses the numbers of the chapter's own examples.
export default {
  'ma4-int-c-01': {
    objective: 'Add, subtract, multiply and divide positive and negative integers, and evaluate a calculation in the correct order of operations.',
    intuition: 'Think of the number line as a road. Adding a positive number walks you to the right and subtracting it walks you to the left. Subtracting a negative number undoes a step to the left, so it moves you right: taking away a debt of $\\$3$ leaves you $\\$3$ better off. Multiplying by a negative number flips a value to the other side of zero, which is why two flips, $(-4)\\times(-3)$, land back on the positive side at $12$.',
    diagrams: [
      {
        title: 'Subtracting a negative number',
        spec: { kind: 'numberLineStepper', op: 'subtract', a: -7, b: -3, min: -12, max: 2, step: 1 },
        note: 'Start at $-7$. Subtracting $-3$ moves $3$ steps to the right, the opposite of subtracting $3$, and lands on $-4$. Change $b$ to $3$ and the jump goes left instead, to $-10$.'
      }
    ]
  },

  'ma4-frc-c-01': {
    objective: 'Convert between fractions, decimals and percentages, add and subtract fractions using a common denominator, and find a percentage of an amount.',
    intuition: 'A fraction names equal parts of one whole, so two fractions can only be added when the parts are the same size. Thirds and quarters do not match, but both can be cut into twelfths: $\\tfrac{1}{3}$ is $4$ twelfths and $\\tfrac{1}{4}$ is $3$ twelfths, which makes $7$ twelfths together. A percentage is a fraction with $100$ equal parts, which is why $75\\%$, $\\tfrac{3}{4}$ and $0.75$ are the same point on the number line.',
    diagrams: [
      {
        title: 'Thirds and quarters as twelfths',
        spec: { kind: 'fractionBar', bars: [{ parts: 3, shaded: 1, label: '\\tfrac{1}{3}' }, { parts: 4, shaded: 1, label: '\\tfrac{1}{4}' }, { parts: 12, shaded: 7, label: '\\tfrac{7}{12}' }] },
        note: 'All three bars are the same length. The third bar is cut into twelfths: $4$ of them cover the same length as $\\tfrac{1}{3}$ and $3$ more cover $\\tfrac{1}{4}$, so $\\tfrac{1}{3}+\\tfrac{1}{4}=\\tfrac{7}{12}$.'
      },
      {
        title: 'Adding fractions on the number line',
        spec: { kind: 'numberLineStepper', op: 'add', a: 0.75, b: 0.5, min: 0, max: 2, step: 0.25, fractions: 4 },
        note: 'Start at $\\tfrac{3}{4}$ and jump $\\tfrac{1}{2}$, which is $2$ quarters. You pass $1$ and land on $\\tfrac{5}{4}=1\\tfrac{1}{4}$. Every tick is a quarter, so both fractions are measured in the same parts.'
      }
    ]
  },

  'ma4-ind-c-01': {
    objective: 'Write repeated multiplication with an index, and use the index laws to simplify products, quotients and powers of powers, including the zero index.',
    intuition: 'An index counts how many times the base is used as a factor. $3^4$ is four threes multiplied together and $3^2$ is two, so dividing cancels two of the threes and leaves $3^2=9$: the indices subtract because the factors cancel. Go down the list $3^3$, $3^2$, $3^1$ and each step divides by $3$. One more step gives $3\\div 3=1$, which is why $3^0=1$.',
    diagrams: [
      {
        title: 'Powers of $3$, one factor at a time',
        spec: { kind: 'sequenceExplorer', type: 'geometric', first: 1, step: 3, n: 5 },
        note: 'The terms are $3^0=1$, $3^1=3$, $3^2=9$, $3^3=27$ and $3^4=81$. Each term is $3$ times the one before, so $3^4\\div 3^2$ walks back two terms, from $81$ to $9$. Set the ratio to $2$ to see the powers of $2$ instead.'
      }
    ]
  },

  'ma4-alg-c-01': {
    objective: 'Simplify expressions by collecting like terms, expand brackets, and substitute values, including negative values, into an expression.',
    intuition: 'A letter stands for a number you have not been told yet, so an expression is a calculation waiting for its input. $3x$ and $5x$ are three and five of the same unknown, so they add to $8x$; $3x$ and $5y$ are different unknowns and stay apart. Expanding $3(x+2)$ is finding the area of a rectangle $3$ wide and $x+2$ long: it splits into a piece of area $3x$ and a piece of area $6$.',
    diagrams: [
      {
        title: 'Expanding $3(x+2)$ as an area',
        spec: { kind: 'areaModel', rows: [{ size: 3, label: '3' }], cols: [{ size: 4, label: 'x' }, { size: 2, label: '2' }], cells: [['3x', '6']] },
        note: 'The rectangle is $3$ by $x+2$. Cut it where $x$ ends: one part is $3$ by $x$, area $3x$, and the other is $3$ by $2$, area $6$. So $3(x+2)=3x+6$, because the $3$ multiplies both terms in the bracket.'
      },
      {
        title: 'Substituting a negative value',
        spec: { kind: 'numberLineStepper', op: 'subtract', a: 5, b: -6, min: -2, max: 14, step: 1 },
        note: 'Put $n=-3$ into $5-2n$. The term $2n$ is $2\\times(-3)=-6$, so you start at $5$ and subtract $-6$. The jump goes $6$ to the right and lands on $11$. The bracket around $-3$ keeps its sign in the calculation.'
      }
    ]
  },

  'ma4-equ-c-01': {
    objective: 'Solve one-step and two-step linear equations, including equations with the unknown on both sides, by doing the same operation to both sides, and check the solution by substituting it.',
    intuition: 'An equation is a balance with two equal sides. Adding, subtracting, multiplying or dividing both sides by the same number keeps it level, so the value of $x$ that balanced it before still balances it after. Solving means undoing what was done to $x$, in reverse order: in $4x-7=21$ the $x$ was multiplied by $4$ and then had $7$ taken off, so add $7$ first and then divide by $4$.',
    diagrams: [
      {
        title: 'Where $ax+b$ reaches $21$',
        spec: {
          kind: 'paramGraph', expr: 'a*x+b',
          params: [{ name: 'a', min: 1, max: 6, step: 1, initial: 4 }, { name: 'b', min: -10, max: 10, step: 1, initial: -7 }],
          xmin: -2, xmax: 12, ymin: -12, ymax: 30, fixed: [{ expr: '21', label: 'y=21' }]
        },
        note: 'The line $y=4x-7$ meets $y=21$ where $x=7$, the solution of $4x-7=21$. Change $b$ to $-3$: the line moves up $4$ and now meets $y=21$ at $x=6$, because $4\\times6-3=21$.'
      }
    ]
  },

  'ma4-lin-c-01': {
    objective: 'Describe a linear relationship by a table, a rule $y=mx+c$ and a graph, find the gradient from two points, and read the $y$-intercept.',
    intuition: 'In a linear relationship every step of $1$ in $x$ changes $y$ by the same amount, so the points line up. That fixed change is the gradient: the rise divided by the run between any two points on the line, and it is the same whichever two points you choose. The $y$-intercept is the value of $y$ when $x=0$, the starting value before any steps are taken.',
    diagrams: [
      {
        title: 'Rise over run between two points',
        spec: {
          kind: 'plane', xmin: -1, xmax: 6, ymin: -2, ymax: 14,
          points: [{ x: 1, y: 3, label: '(1,3)', pos: 'nw' }, { x: 4, y: 12, label: '(4,12)', pos: 'nw' }],
          lines: [{ through: [[1, 3], [4, 12]], label: 'y=3x' }],
          segments: [{ from: [1, 3], to: [4, 3], label: '\\text{run } 3', dashed: true }, { from: [4, 3], to: [4, 12], label: '\\text{rise } 9', dashed: true }]
        },
        note: 'From $(1,3)$ to $(4,12)$ the run is $4-1=3$ and the rise is $12-3=9$, so the gradient is $\\tfrac{9}{3}=3$. The line passes through the origin, so its rule is $y=3x$.'
      }
    ]
  },

  'ma4-rat-c-01': {
    objective: 'Simplify ratios, divide a quantity in a given ratio, and convert a rate to a unit rate to solve problems.',
    intuition: 'A ratio such as $4:5$ says the amounts come in equal-sized shares: $4$ shares for one person and $5$ for the other, $9$ in all. Find the size of one share and every question about the ratio becomes multiplication. A rate works the same way with one unit as the share: $76$ km in each hour, so $5$ hours is $5$ shares of $76$ km.',
    diagrams: [
      {
        title: 'Sharing $\\$450$ in the ratio $4:5$',
        spec: { kind: 'fractionBar', bars: [{ parts: 9, shaded: 4, label: '\\text{Mia}' }, { parts: 9, shaded: 5, label: '\\text{Noah}' }] },
        note: 'The $\\$450$ is cut into $4+5=9$ equal shares of $\\$450\\div 9=\\$50$. Mia has $4$ shares, $\\$200$, and Noah has $5$, $\\$250$. The two shaded parts together make one whole bar.'
      },
      {
        title: 'Speed is the gradient',
        spec: {
          kind: 'paramGraph', expr: 'k*x',
          params: [{ name: 'k', min: 20, max: 100, step: 4, initial: 76, label: '\\text{speed (km/h)}' }],
          xmin: 0, xmax: 6, ymin: 0, ymax: 600
        },
        note: 'The horizontal axis is time in hours and the vertical axis is distance in km. At $k=76$ the line passes through $(5,380)$: $5$ hours at $76$ km/h is $380$ km. Set $k$ to $80$ and the line is steeper; after $3$ hours the distance is $240$ km.'
      }
    ]
  },

  'ma4-len-c-01': {
    objective: 'Convert between metric units of length, find the perimeter of polygons and composite shapes, and find the circumference of a circle from its radius or diameter.',
    intuition: 'Perimeter is the length of string you would need to go once around the edge, so it is found by adding the sides, all in the same unit. A circle has no straight sides, but every circle is the same shape, so its circumference is always the same multiple of its diameter: a little more than $3$ times, the number $\\pi$. That is why $C=\\pi d$, and since a diameter is two radii, $C=2\\pi r$.',
    diagrams: [
      {
        title: 'Fencing the garden',
        spec: {
          kind: 'plane', xmin: -2, xmax: 15, ymin: -2, ymax: 10, axes: false,
          polygons: [{ points: [[0, 0], [12.5, 0], [12.5, 8], [0, 8]] }],
          segments: [{ from: [0, 0], to: [12.5, 0], label: '12.5\\text{ m}' }, { from: [12.5, 0], to: [12.5, 8], label: '8\\text{ m}' }]
        },
        note: 'Going once round the garden is $12.5+8+12.5+8=41$ m, which is $2(12.5+8)$. Opposite sides are equal, so two lengths and two widths cover the whole edge.'
      },
      {
        title: 'Radius, diameter and circumference',
        spec: {
          kind: 'plane', xmin: -7, xmax: 7, ymin: -7, ymax: 7, axes: false,
          circles: [{ cx: 0, cy: 0, r: 5 }],
          points: [{ x: 0, y: 0, label: 'O', pos: 'sw' }],
          segments: [{ from: [-5, 0], to: [5, 0], label: 'd=10' }, { from: [0, 0], to: [0, 5], label: 'r=5', dashed: true }]
        },
        note: 'The radius is $5$ cm and the diameter is $10$ cm. Once around the circle is $\\pi$ diameters: $C=\\pi\\times10\\approx31.4$ cm. Putting the diameter into $C=2\\pi r$ gives $20\\pi\\approx62.8$ cm, double the true length.'
      }
    ],
    interactiveNone: 'Perimeter and circumference come from adding fixed lengths or one formula with one measurement. The labelled figures show every number a slider would, and nothing changes shape in a way that teaches more.'
  },

  'ma4-are-c-01': {
    objective: 'Find the area of rectangles, triangles and parallelograms, convert between square units, and find the area of a composite shape by adding or subtracting simpler shapes.',
    intuition: 'Area counts unit squares: a $10$ by $6$ rectangle holds $6$ rows of $10$ squares, $60$ in all. A parallelogram is a rectangle with a triangle sliced off one end and moved to the other, so it has the area of the rectangle with the same base and perpendicular height. A diagonal cuts the parallelogram into two identical triangles, which is where the $\\tfrac{1}{2}$ in $A=\\tfrac{1}{2}bh$ comes from.',
    diagrams: [
      {
        title: 'A parallelogram rearranged into a rectangle',
        spec: {
          kind: 'plane', xmin: -1, xmax: 12, ymin: -1, ymax: 7, axes: false,
          polygons: [{ points: [[0, 0], [8, 0], [11, 5], [3, 5]], shade: true }],
          segments: [{ from: [3, 5], to: [3, 0], label: 'h=5', dashed: true }, { from: [8, 0], to: [11, 0], dashed: true }, { from: [11, 0], to: [11, 5], dashed: true }, { from: [0, 0], to: [8, 0], label: 'b=8' }]
        },
        note: 'Cut the triangle off the left end, under the dashed height, and slide it to the right end: the parallelogram becomes an $8$ by $5$ rectangle with area $40$ square units. The slanted side is about $5.8$ units long and is not the height.'
      },
      {
        title: 'The lawn with the path cut out',
        spec: {
          kind: 'plane', xmin: -2, xmax: 12, ymin: -2, ymax: 8, axes: false,
          polygons: [{ points: [[0, 0], [7, 0], [7, 2], [10, 2], [10, 6], [0, 6]], shade: true, label: '\\text{grass}' }, { points: [[7, 0], [10, 0], [10, 2], [7, 2]], label: '\\text{path}' }],
          segments: [{ from: [0, 6], to: [10, 6], label: '10' }, { from: [0, 0], to: [0, 6], label: '6' }, { from: [7, 0], to: [10, 0], label: '3' }, { from: [10, 0], to: [10, 2], label: '2' }]
        },
        note: 'The whole lawn is $10\\times6=60\\text{ m}^2$ and the path is $3\\times2=6\\text{ m}^2$, which leaves $54\\text{ m}^2$ of grass. Splitting the grass into a $7$ by $6$ and a $3$ by $4$ rectangle gives the same total, $42+12=54$.'
      }
    ],
    interactiveNone: 'Each area here comes from fixed measurements of one shape and its rearrangement. The cut-and-move figures show the reason for each formula, and a slider would only change the numbers, not the idea.'
  },

  'ma4-vol-c-01': {
    objective: 'Find the volume of rectangular and other prisms with $V=Ah$, and convert between cubic units, millilitres and litres.',
    intuition: 'Volume counts unit cubes. Cover the base of a box with one layer of cubes, then stack layers up to the height: the number of cubes in one layer is the base area, and the number of layers is the height. The same stacking works for any prism, because every slice along it is a copy of the cross-section. A $1$ cm cube holds exactly $1$ mL, which links volume to capacity.',
    diagrams: [
      {
        title: 'The fish tank',
        spec: { kind: 'solid', shape: 'rectPrism', l: 60, w: 30, h: 40 },
        note: 'The base is $60$ cm by $30$ cm, area $1800\\text{ cm}^2$, and there are $40$ layers, so $V=1800\\times40=72\\,000\\text{ cm}^3$. Every $1000\\text{ cm}^3$ is a litre, so the tank holds $72$ L.'
      },
      {
        title: 'Layers of cubes in a box',
        spec: { kind: 'solidExplorer', shape: 'rectPrism', l: 5, w: 4, h: 3 },
        note: 'At $5$ by $4$ by $3$ the box holds $60$ unit cubes: $20$ in each layer and $3$ layers. Double the height and the volume doubles to $120\\text{ cm}^3$. Double every edge and it becomes $8$ times as large, $480\\text{ cm}^3$.'
      }
    ]
  },

  'ma4-ang-c-01': {
    objective: 'Find unknown angles using angles at a point, angles on a straight line, vertically opposite angles and the angles formed when a transversal cuts parallel lines, giving a reason for each step.',
    intuition: 'A straight line is half a full turn, so the angles along it add to $180^\\circ$, and a full turn around a point is $360^\\circ$. When a transversal crosses two parallel lines it meets both at the same slant, so the four angles at one crossing are a copy of the four at the other. That is why corresponding and alternate angles are equal, and why co-interior angles, one from each crossing on the same side, add to $180^\\circ$.',
    diagrams: [
      {
        title: 'Co-interior angles are supplementary',
        spec: { kind: 'parallelLines', angle: 68, mark: 'coInterior' },
        note: 'The transversal meets the parallel lines at $68^\\circ$. The two marked angles lie between the parallel lines on the same side of the transversal: $112^\\circ+68^\\circ=180^\\circ$. They are not equal; one is acute and one is obtuse.'
      },
      {
        title: 'The angles of a triangle',
        spec: { kind: 'triangleExplorer', mode: 'angleSum', initial: { A: 50, B: 65 } },
        note: 'With angles of $50^\\circ$ and $65^\\circ$, the third is $180^\\circ-115^\\circ=65^\\circ$. Move a vertex: each angle changes, but the total in the readout stays $180^\\circ$.'
      }
    ]
  },

  'ma4-geo-c-01': {
    objective: 'Use angle facts for parallel lines, triangles, quadrilaterals and polygons to find unknown angles with reasons, and decide whether two triangles are congruent by SSS, SAS, AAS or RHS.',
    intuition: 'The polygon facts come from the triangle. Pick one vertex of an $n$-sided polygon and draw every diagonal from it: they cut the polygon into $n-2$ triangles, each with angles adding to $180^\\circ$, so the interior angles add to $(n-2)\\times180^\\circ$. Walk around the outside and you turn through each exterior angle once, finishing where you started after one full turn of $360^\\circ$. A congruence test lists the least you need to know so that only one triangle can be built.',
    diagrams: [
      {
        title: 'Co-interior angles $x^\\circ$ and $(2x+30)^\\circ$',
        spec: { kind: 'parallelLines', angle: 50, mark: 'coInterior' },
        note: 'Co-interior angles add to $180^\\circ$, so $x+2x+30=180$, which gives $3x=150$ and $x=50$. The marked angles are $50^\\circ$ and $130^\\circ$, as drawn.'
      },
      {
        title: 'The angle sum stays $180^\\circ$',
        spec: { kind: 'triangleExplorer', mode: 'angleSum', initial: { A: 40, B: 70 } },
        note: 'This starts as the isosceles triangle with apex $40^\\circ$: the base angles are $70^\\circ$ each, and $40+70+70=180$. Move a vertex and the three angles change together, but their total is always $180^\\circ$.'
      }
    ]
  },

  'ma4-pyt-c-01': {
    objective: 'Use Pythagoras’ theorem to find the hypotenuse or a shorter side of a right-angled triangle, and use its converse to decide whether a triangle is right-angled.',
    intuition: 'Draw a square on each side of a right-angled triangle. The two squares on the shorter sides together have exactly the same area as the square on the hypotenuse: for sides $3$, $4$ and $5$ that is $9+16=25$. The theorem is a statement about areas, which is why the sides are squared before they are added. The hypotenuse is always the longest side, opposite the right angle.',
    diagrams: [
      {
        title: 'Squares on the sides of a $3$, $4$, $5$ triangle',
        spec: {
          kind: 'plane', xmin: -5, xmax: 8, ymin: -4, ymax: 8, axes: false,
          polygons: [
            { points: [[0, 0], [3, 0], [0, 4]], shade: true },
            { points: [[0, 0], [3, 0], [3, -3], [0, -3]], label: '9' },
            { points: [[0, 0], [0, 4], [-4, 4], [-4, 0]], label: '16' },
            { points: [[3, 0], [0, 4], [4, 7], [7, 3]], label: '25' }
          ],
          angles: [{ at: [0, 0], from: [3, 0], to: [0, 4], right: true }]
        },
        note: 'The squares on the legs $3$ and $4$ have areas $9$ and $16$. The square on the hypotenuse $5$ has area $25$, which is exactly $9+16$.'
      },
      {
        title: 'Change the legs, keep the right angle',
        spec: { kind: 'triangleExplorer', mode: 'pythagoras', initial: { a: 6, b: 8 } },
        note: 'With legs $6$ and $8$ the readout shows $36+64=100$, so the hypotenuse is $10$. Change a leg: the three squares change, but while the angle stays $90^\\circ$ the two smaller areas always add to the largest.'
      }
    ]
  },

  'ma4-pro-c-01': {
    objective: 'Find the probability of an event from equally likely outcomes, use $P(\\text{not }A)=1-P(A)$, and estimate a probability from the relative frequency of repeated trials.',
    intuition: 'When every outcome is equally likely, probability is a fair share: with $10$ marbles in the bag each has $1$ chance in $10$, and the $7$ marbles that are not blue give $\\tfrac{7}{10}$. An event and its complement share all the outcomes between them, so their probabilities add to $1$. When outcomes are not equally likely you can only estimate, by repeating the experiment, and the more trials you run the closer the relative frequency tends to settle near the true probability.',
    diagrams: [
      {
        title: 'Drawing from the bag many times',
        spec: {
          kind: 'probabilitySim', experiment: 'bag',
          bag: [{ label: 'Red', weight: 5 }, { label: 'Blue', weight: 3 }, { label: 'Green', weight: 2 }],
          event: ['Red', 'Green'], seed: 7
        },
        note: 'Each draw is put back before the next. The theoretical probability of not blue is $\\tfrac{7}{10}=0.7$. After $10$ draws the relative frequency can be well away from $0.7$; after $1000$ it settles close to it. More trials make the estimate steadier, never certain.'
      }
    ]
  },

  'ma4-dat-c-02': {
    objective: 'Find the mean, median, mode and range of a data set, and decide which measure of centre best describes the data when there is an outlier.',
    intuition: 'The mean shares the total out equally: if everyone pooled their values and split them evenly, each would get the mean. That is why one very large value drags the mean up. The median depends only on order, the value in the middle, so it barely notices how extreme the end values are. The range is the distance from the smallest value to the largest.',
    diagrams: [
      {
        title: 'An outlier moves the mean, not the median',
        spec: { kind: 'dataExplorer', data: [12, 15, 9, 20, 14], editable: [3], min: 0, max: 50, show: ['mean', 'median', 'range'] },
        note: 'For $9, 12, 14, 15, 20$ the mean and the median are both $14$. Drag $20$ up to $45$: the mean jumps to $19$ and the range to $36$, but the median stays at $14$ because $14$ is still the middle value.'
      }
    ]
  },

  'ma4-dat-c-01': {
    objective: 'Classify data as categorical or numerical and as discrete or continuous, organise it in a frequency table with equal class intervals, and choose and read a graph that displays it fairly.',
    intuition: 'A graph is honest when a reader can get the numbers back from it. A sector graph cuts one full turn of $360^\\circ$ in proportion to the frequencies, so $12$ students out of $40$ get $\\tfrac{12}{40}$ of the circle, which is $108^\\circ$. A histogram needs equal class widths, or a wider bar looks bigger than its share of the data.',
    diagrams: [
      {
        title: 'How $40$ students travel to school',
        spec: { kind: 'pieChart', categories: ['Walk', 'Bus', 'Car', 'Bike'], values: [12, 16, 8, 4] },
        note: 'Walking is $\\tfrac{12}{40}$ of the circle, $108^\\circ$. Bus is $\\tfrac{16}{40}$, $144^\\circ$; car is $72^\\circ$ and bike is $36^\\circ$. The four angles add to $360^\\circ$.'
      },
      {
        title: 'Test marks as a dot plot',
        spec: { kind: 'dataExplorer', data: [12, 18, 23, 25, 29, 31, 34, 36, 41, 47], editable: [9], show: ['range'] },
        note: 'The marks run from $12$ to $47$, a range of $35$, so $5$ classes of width $8$ starting at $10$ cover them, the last class running from $42$ up to $50$. Drag the top mark to $52$: the range becomes $40$, that mark falls outside every class, and the class width has to grow.'
      }
    ]
  }
};
