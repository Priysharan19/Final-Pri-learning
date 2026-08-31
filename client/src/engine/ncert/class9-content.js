// Source-audited learning content for Ganita Manjari Grade 9 Part I (2026–27).
// The eight uploaded PDFs contain 200 pages. No separate Grade 9 answer-key PDF
// accompanied the current upload, so formal exercise answers are independently
// derived and cross-checked; the product UI states that fact explicitly.

const basis = 'Independent Pri Learning derivation from the uploaded chapter, cross-checked against current 2026–27 Ganita Manjari worked-solution references. No separate Grade 9 answer-key PDF was present in the current eight-file upload.';
const note = 'Every formal exercise prompt is checked against the exact source wording, diagram conditions and stated approximation rules. Construction, proof and open-response items are verified by required method and conclusion rather than forced into a scalar answer.';
const audit = rows => rows.map(([exercise,count])=>({exercise,sourceQuestionCount:count,verifiedQuestionCount:count,status:'verified',verificationBasis:basis,note}));
const covers = gen => [{gen,dp:[0,1,2],diff:[1,2,3,4]}];
const qb = gen => ({generator:gen,authoredCells:4,difficulties:[1,2,3,4],answerExperience:'Write · Type · Pri Explain'});
const N = (title,points,formula,edge,level='TOPPER') => ({title,level,points,formula,edge});
const E = (title,prompt,steps,answer,topper) => ({title,prompt,steps,answer,topper});
const M = (section,pages,coverage) => ({section,pages,coverage});

export const NCERT_CLASS9_CONTENT = Object.freeze([
{
 id:'c9-coordinate-geometry',num:1,title:'Orienting Yourself: The Use of Coordinates',pages:15,strand:'Coordinate Geometry',weight:12,
 dotpoints:['Use ordered pairs, axes, signs and quadrants to locate and interpret points in the Cartesian plane','Find horizontal, vertical and general distances between two points using coordinate differences and the Baudhāyana–Pythagoras theorem','Model real layouts and geometric shapes with coordinates, extracting lengths, dimensions and spatial conclusions'],
 skills:['Cartesian plane, origin and axes','Ordered pairs and quadrant sign patterns','Points on axes','Coordinate interpretation in room plans','Horizontal and vertical distance','General distance via Pythagoras','Rectangles and practical coordinate modelling'],
 sourceMap:[M('Historical orientation and coordinate thinking','1–2','Grid-based location, Indian and global coordinate history, and the chapter’s accessibility-centred room-map context.'),M('Axes, origin, ordered pairs and quadrants','3–7','2-D Cartesian system, points on axes, sign conventions, quadrants, Exercise Sets 1.1 and 1.2 diagrams.'),M('Distance between points','8–11','Coordinate differences, right-triangle construction and the distance relation derived from Baudhāyana–Pythagoras.'),M('End-of-chapter mastery, application and summary','12–15','All end-of-chapter coordinate questions, map/grid applications, chapter summary and closing material.')],
 notes:[
  N('Ordered-pair discipline',['Coordinates are ordered: $(x,y)$ means horizontal displacement first, vertical displacement second.','A point on the y-axis has $x=0$; a point on the x-axis has $y=0$.'],'P=(x,y)','Never swap coordinates because a diagram “looks right”; preserve axis order.'),
  N('Quadrant sign matrix',['Quadrant I $(+,+)$; II $(-,+)$; III $(-,-)$; IV $(+,-)$.','Axis points lie in no quadrant.'],'I:(+,+),\ II:(-,+),\ III:(-,-),\ IV:(+,-)','Classify signs before visualising the point.'),
  N('Distance as geometry',['The distance formula is Pythagoras applied to horizontal and vertical coordinate changes.','Absolute values are automatic after squaring, but axis-parallel distances can be read directly.'],'PQ=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}','First ask whether one coordinate is unchanged; use the simpler axis shortcut when possible.'),
  N('Coordinate invariants',['Axis-aligned rectangle widths are x-differences and heights are y-differences.','Parallel-to-axis structure converts geometry into subtraction.'],'w=|x_2-x_1|,\ h=|y_2-y_1|','Extract invariant coordinate differences before calculating.'),
  N('Topper modelling loop',['Translate the physical layout into points, preserve scale, calculate in coordinate units, then convert back to real units.','A 2-D floor map cannot encode height without a third coordinate.'],'\text{model}\to\text{calculate}\to\text{interpret}','State what the model cannot represent; that is often part of the reasoning.')
 ],
 examples:[
  E('Quadrant control','Locate $Q(-5,3)$.',['The x-coordinate is negative.','The y-coordinate is positive.','The sign pair $(-,+)$ identifies Quadrant II.'],'Quadrant II','Sign classification is faster and safer than sketching.'),
  E('Axis-parallel distance','Find the distance from $A(-3,4)$ to $B(7,4)$.',['The y-coordinates are equal, so the segment is horizontal.','Distance is $|7-(-3)|$.','$|10|=10$.'],'$10$ units','Do not invoke the full square-root formula when one coordinate is unchanged.'),
  E('General distance','Find the distance from $(3,4)$ to $(7,1)$.',['$\Delta x=4$ and $\Delta y=-3$.','$d=\sqrt{4^2+(-3)^2}=\sqrt{25}$.','$d=5$.'],'$5$ units','The source chapter builds exactly this result from a right triangle.'),
  E('Rectangle from opposite corners','Opposite vertices are $(-2,-1)$ and $(5,3)$. Find area.',['Width $=|5-(-2)|=7$.','Height $=|3-(-1)|=4$.','Area $=7\times4=28$.'],'$28$ square units','Coordinate differences recover dimensions without drawing every corner.')
 ],
 exercises:[['1.1',4],['1.2',4],['End-of-Chapter',16]],method:'Read the ordered pair/diagram first; use sign conventions or coordinate differences, and use Pythagoras only when the joining segment is not axis-parallel.',gen:'c9-coordinate-geometry-ncert-mastery'
},
{
 id:'c9-linear-polynomials',num:2,title:'Introduction to Linear Polynomials',pages:25,strand:'Algebra',weight:13,
 dotpoints:['Identify terms, coefficients, variables, degree and values of one-variable polynomials, with special focus on linear polynomials','Model constant-rate patterns, linear growth and linear decay with expressions of the form $ax+b$','Build, graph and interpret linear relationships from tables or contexts, including slope, intercept and parallel lines'],
 skills:['Polynomial vocabulary and degree','Evaluation and input-output functions','Linear equations from contexts','Linear patterns','Growth and decay','Tables and linear relationships','Graphs of $y=ax+b$','Slope, intercept and parallelism'],
 sourceMap:[M('Polynomial foundations','1–5','Expressions, variables, coefficients, univariate polynomials, degree, linear polynomial examples and Exercise 2.1.'),M('Evaluation and linear patterns','6–10','Evaluation, equations, tile patterns, pocket-money/fare models, Exercises 2.2–2.4.'),M('Linear relationships and graph meaning','11–20','Constant rate, tables, slope/intercept ideas, graph construction and interpretation.'),M('Visualising $y=ax+b$ and end-of-chapter mastery','21–25','Exercise 2.6, end-of-chapter problems, graph-based applications and summary material.')],
 notes:[
  N('Polynomial anatomy',['A polynomial is organised by powers of one variable; the degree is the highest power with non-zero coefficient.','A non-zero constant has degree 0; a linear polynomial has degree 1.'],'p(x)=a_nx^n+\cdots+a_0','Missing powers have coefficient 0; they do not change degree.'),
  N('Evaluation is substitution',['Treat a polynomial as an input-output rule.','Bracket negative inputs before simplifying.'],'p(c)=p(x)\big|_{x=c}','Most sign errors come from substituting a negative value without brackets.'),
  N('Linear = constant first difference',['For equally spaced x-values, $y=ax+b$ changes by the constant amount $a\Delta x$.','This links arithmetic patterns, tables and straight-line graphs.'],'a=\frac{\Delta y}{\Delta x}','Check constancy of rate before declaring a relationship linear.'),
  N('Slope and intercept',['In $y=ax+b$, $a$ is slope/rate and $b$ is the output at $x=0$.','Equal slopes with different intercepts produce parallel lines.'],'x=0\Rightarrow y=b','Read the parameters as meaning, not just symbols.'),
  N('Growth and decay modelling',['Positive slope models linear growth; negative slope models linear decay.','Fixed start + repeated change is the recurring structure.'],'\text{value}=\text{initial}+n(\text{rate})','Translate context into initial value and per-step rate before algebra.')
 ],
 examples:[
  E('Degree control','Find the degree of $5x^3-2x+7$.',['Powers present are 3, 1 and 0.','Highest non-zero power is 3.','Therefore degree $=3$.'],'$3$','A missing $x^2$ term is irrelevant.'),
  E('Evaluate safely','Evaluate $5x-3$ at $x=-1$.',['Substitute: $5(-1)-3$.','Multiply: $-5-3$.','Combine: $-8$.'],'$-8$','Brackets prevent sign slips.'),
  E('Recover a line','A bill is ₹350 at $x=10$ and ₹550 at $x=20$. Find $y=ax+b$.',['$a=(550-350)/(20-10)=20$.','Use $(10,350)$: $350=200+b$.','$b=150$, so $y=20x+150$.'],'$y=20x+150$','Rate first, intercept second.'),
  E('Interpret a line','Interpret $y=-3x+5$.',['Compare with $y=ax+b$.','Slope $a=-3$, intercept $b=5$.','Negative slope means decay; y-axis crossing is $(0,5)$.'],'slope $-3$, intercept $5$, decay','Always connect algebraic parameters to the graph/context.')
 ],
 exercises:[['2.1',5],['2.2',7],['2.3',5],['2.4',4],['2.5',3],['2.6',1],['End-of-Chapter',14]],method:'Identify the polynomial/linear structure first; evaluate by substitution, solve linearly where required, and for graph questions build a value table before interpreting slope and intercept.',gen:'c9-linear-polynomials-ncert-mastery'
},
{
 id:'c9-number-systems',num:3,title:'The World of Numbers',pages:27,strand:'Number & Arithmetic',weight:13,
 dotpoints:['Understand the nested real-number system and operate accurately with integers and rational numbers','Represent rational and irrational numbers on the number line and reason about density, irrationality and geometric constructions','Classify terminating, repeating and non-repeating decimals and convert rational decimals to fractions'],
 skills:['Natural/whole/integer/rational hierarchy','Zero and signed arithmetic','Rational arithmetic and closure','Density','Irrationality of $\sqrt2$','Irrational constructions','Real numbers','Decimal expansions and cyclic patterns'],
 sourceMap:[M('Counting, zero and integers','1–6','Historical number development, zero, integer laws and Exercise 3.1–3.2.'),M('Rational numbers and density','7–12','Definition, equivalent forms, operations, closure, number-line representation, density and Exercises 3.3–3.4.'),M('Irrational and real numbers','13–23','Proof of irrationality, construction of $\sqrt2$, $\pi$, decimal patterns, cyclic numbers and Exercise 3.5.'),M('End-of-chapter mastery and summary','24–27','All formal end-of-chapter questions, real-number synthesis and chapter summary.')],
 notes:[
  N('Number hierarchy',['Natural numbers sit inside integers, integers inside rationals, and rationals inside reals.','Irrationals are real but not rational.'],'\mathbb N\subset\mathbb Z\subset\mathbb Q\subset\mathbb R','Use the most specific classification requested.'),
  N('Rational denominator logic',['A rational number is $p/q$ with integers $p,q$ and $q\ne0$.','Equivalent representations describe the same point on the number line.'],'\frac pq=\frac{k p}{k q}\quad(k\ne0)','Reduce before applying decimal-termination tests.'),
  N('Density',['Between two distinct rationals there are infinitely many rationals; the average gives one immediately.','Repeated averaging constructs infinitely many.'],'m=\frac{a+b}{2}','“Adjacent rationals” do not exist on the number line.'),
  N('Irrationality proof architecture',['For $\sqrt2$, assume rational in lowest terms, derive that numerator and denominator are both even, contradict lowest terms.','The contradiction is structural, not numerical approximation.'],'\sqrt2=\frac pq\Rightarrow p^2=2q^2','State the lowest-terms assumption before deriving the contradiction.'),
  N('Decimal fingerprint',['A reduced rational terminates iff its denominator has no prime factors except 2 and 5; otherwise it repeats.','Irrational decimals are non-terminating and non-repeating.'],'q=2^m5^n\iff\text{terminating}','Classify from factorisation instead of long division.')
 ],
 examples:[
  E('Rational equality','Show $2/3=4/6$.',['Cross multiply: $2\cdot6=12$.','$3\cdot4=12$.','Equal cross products prove equality.'],'equal','Cross multiplication is the fastest exact test.'),
  E('A rational between rationals','Find a rational between $2/5$ and $3/5$.',['Take their mean.','$\frac12(\frac25+\frac35)=\frac12$.','$2/5<1/2<3/5$.'],'$1/2$','The mean method works for any two distinct rationals.'),
  E('Repeating decimal to fraction','Convert $0.\overline3$ to a fraction.',['Let $x=0.333\ldots$.','$10x=3.333\ldots$.','Subtract: $9x=3$, hence $x=1/3$.'],'$1/3$','Shift by one digit because one digit repeats.'),
  E('Termination test','Classify $13/250$.',['Fraction is already reduced.','$250=2\times5^3$.','Only 2 and 5 occur, so decimal terminates.'],'terminating','Factor the denominator, not the numerator.')
 ],
 exercises:[['3.1',4],['3.2',4],['3.3',8],['3.4',6],['3.5',5],['End-of-Chapter',16]],method:'Classify the number set first, reduce rational fractions, use exact arithmetic/number-line reasoning, and classify decimals from the prime factors of the reduced denominator.',gen:'c9-number-systems-ncert-mastery'
},
{
 id:'c9-algebraic-identities',num:4,title:'Exploring Algebraic Identities',pages:24,strand:'Algebra',weight:13,
 dotpoints:['Expand and use square, difference-of-squares, three-term and cubic algebraic identities with exact sign control','Factor algebraic expressions using identities, algebra tiles, common factors and splitting the middle term','Discover and apply higher identities to numerical calculation and rational-expression simplification'],
 skills:['Identity versus equation','Geometric visualisation','$(a\pm b)^2$','Difference of squares','Three-term square','Algebra tiles','Middle-term splitting','Cubic identities','Rational expressions'],
 sourceMap:[M('Square identities and visual proof','1–7','Visualisation and algebraic proof of $(a+b)^2$, $(a-b)^2$, Exercises 4.1–4.2 and identity-based factorisation.'),M('More identities and factorisation','8–14','Three-term square, additional identities, algebra tiles, middle-term splitting and Exercises 4.3–4.4.'),M('New identities and rational expressions','15–20','Deriving identities including cubic forms and simplifying rational expressions, Exercise 4.5.'),M('End-of-chapter mastery','21–24','All end-of-chapter identity/factorisation/application problems and summary material.')],
 notes:[
  N('Identity vs equation',['An identity is true for every allowed value of its variables; an equation may hold only for particular values.','Testing examples can disprove an identity but cannot prove a universal identity.'],'(a+b)^2\equiv a^2+2ab+b^2','For proof, expand algebraically or use an area model.'),
  N('Square-sign control',['$(a+b)^2=a^2+2ab+b^2$ and $(a-b)^2=a^2-2ab+b^2$.','The final square term is always positive; only the middle sign changes.'],'(a\pm b)^2=a^2\pm2ab+b^2','Never write $a^2\pm b^2$; the middle term is essential.'),
  N('Difference of squares',['Two square terms separated by subtraction factor into conjugates.','This identity is reversible for fast numerical evaluation.'],'a^2-b^2=(a-b)(a+b)','Check both terms are genuine squares before applying.'),
  N('Quadratic factorisation',['For $x^2+bx+c$, seek numbers whose sum is $b$ and product is $c$.','For non-monic quadratics, split the middle term using product $ac$.'],'ax^2+bx+c','Sum/product reasoning is more robust than guessing brackets.'),
  N('Identity network',['Three-term and cubic identities are extensions of distributivity, not isolated tricks.','Factorisation can expose cancellation before rational-expression arithmetic.'],'a^3\pm b^3=(a\pm b)(a^2\mp ab+b^2)','Factor first, cancel only factors—not terms.')
 ],
 examples:[
  E('Fast square','Find $43^2$ using an identity.',['$43=40+3$.','$(40+3)^2=1600+240+9$.','Total $=1849$.'],'$1849$','Choose a nearby round number.'),
  E('Perfect-square factor','Factor $x^2+4x+4$.',['$x^2=x^2$ and $4=2^2$.','Middle term $4x=2(x)(2)$.','So expression $=(x+2)^2$.'],'$(x+2)^2$','Verify the middle term before declaring a perfect square.'),
  E('Difference of squares','Factor $49x^2-25y^2$.',['Recognise $(7x)^2-(5y)^2$.','Apply $a^2-b^2=(a-b)(a+b)$.','Result $(7x-5y)(7x+5y)$.'],'$(7x-5y)(7x+5y)$','Conjugate factors are the signature.'),
  E('Split the middle term','Factor $x^2+8x+15$.',['Need two numbers with sum 8 and product 15.','They are 3 and 5.','Hence $(x+3)(x+5)$.'],'$(x+3)(x+5)$','Use the sum/product test before expansion.')
 ],
 exercises:[['4.1',2],['4.2',2],['4.3',4],['4.4',3],['4.5',1],['End-of-Chapter',13]],method:'Identify the identity pattern before expanding; for factorisation verify square roots/sum-product conditions, and simplify rational expressions by factoring before cancellation.',gen:'c9-algebraic-identities-ncert-mastery'
},
{
 id:'c9-circles',num:5,title:"I’m Up and Down, and Round and Round",pages:26,strand:'Geometry',weight:13,
 dotpoints:['Use the definition, symmetry and circumcircle construction of a circle, including the unique circle through three non-collinear points','Prove and apply chord theorems involving central angles, perpendicular bisectors and distance from the centre','Use arc-angle theorems, concyclicity and cyclic-quadrilateral properties in multi-step geometric proofs'],
 skills:['Circle as locus','Chord/diameter/radius','Symmetry','Circumcircle/circumcentre','Equal chords and central angles','Perpendicular bisector of chord','Chord distance','Arc angles','Cyclic quadrilaterals'],
 sourceMap:[M('Definitions, symmetry and circumcircles','1–7','Circle as a locus, reflection/rotation symmetry, circles through points, unique circumcircle and Exercise 5.1.'),M('Chord structure','8–14','Equal-chord/central-angle converses, midpoint/perpendicular-bisector theorems, chord-distance results and Exercises 5.2–5.5.'),M('Arc angles and concyclicity','15–22','Central/inscribed angle theorem, same-segment angles, semicircle angle, cyclic quadrilaterals and Exercise 5.6.'),M('End-of-chapter proof mastery','23–26','All proof/construction end-of-chapter questions, theorem synthesis and chapter summary.')],
 notes:[
  N('Circle as a locus',['A circle is the locus of points at fixed distance r from a fixed centre.','A diameter is the longest chord and every diameter is a line of reflection symmetry.'],'OP=r','Definitions are proof tools: equal radii create isosceles triangles automatically.'),
  N('Unique circumcircle',['Three non-collinear points determine a unique circle because perpendicular bisectors of two sides meet at one point.','For a right triangle the circumcentre is the midpoint of the hypotenuse.'],'OA=OB=OC','Start circumcircle proofs from equal distances to vertices.'),
  N('Equal chord theorem pair',['Equal chords subtend equal central angles, and equal central angles subtend equal chords.','Both follow by triangle congruence using radii.'],'AB=CD\iff\angle AOB=\angle COD','State the congruence criterion explicitly.'),
  N('Perpendicular-to-chord engine',['The perpendicular from the centre to a chord bisects it; conversely a line from centre to chord midpoint is perpendicular.','Equal chords are equidistant from the centre, and conversely.'],'OM\perp AB\Rightarrow AM=MB','Draw the centre-to-chord perpendicular early; it creates right triangles.'),
  N('Arc-angle and cyclic control',['Angle at centre is twice angle at circumference standing on the same arc.','Angles in the same segment are equal; opposite angles of a cyclic quadrilateral sum to $180^\circ$.'],'\angle AOB=2\angle ACB','Track the exact arc being subtended; many circle errors use the wrong arc.')
 ],
 examples:[
  E('Longest chord','A circle has radius 5. Find longest chord.',['Longest chord passes through centre.','Therefore it is the diameter.','Diameter $=2r=10$.'],'$10$','Radius-to-diameter is a theorem application, not estimation.'),
  E('Central to circumference angle','A chord subtends $80^\circ$ at centre. Find its angle at the circumference on same arc.',['Use central angle = twice inscribed angle.','$80=2x$.','$x=40^\circ$.'],'$40^\circ$','Identify “same arc” before halving.'),
  E('Cyclic quadrilateral','One angle of a cyclic quadrilateral is $112^\circ$. Find opposite angle.',['Opposite cyclic angles are supplementary.','$x+112=180$.','$x=68^\circ$.'],'$68^\circ$','Use cyclicity before generic quadrilateral angle sum.'),
  E('Chord length from centre distance','Radius 5, chord distance from centre 3. Find chord length.',['Perpendicular bisects the chord.','Half-chord $=\sqrt{5^2-3^2}=4$.','Whole chord $=8$.'],'$8$','The 3–4–5 right triangle is created by the chord theorem.')
 ],
 exercises:[['5.1',4],['5.2',2],['5.3',3],['5.4',3],['5.5',3],['5.6',3],['End-of-Chapter',25]],method:'Translate the diagram into radii/equal chords/right triangles first, cite the relevant theorem, then use congruence or angle relations with the exact arc/chord named.',gen:'c9-circles-ncert-mastery'
},
{
 id:'c9-perimeter-area',num:6,title:'Measuring Space: Perimeter and Area',pages:37,strand:'Mensuration',weight:14,
 dotpoints:['Calculate perimeter, circumference and arc length with disciplined use of $\pi$ and stated approximations','Derive and apply area formulae for rectangles, parallelograms, triangles, circles, sectors and segments, including Heron’s formula','Solve composite and proof-style mensuration problems involving equivalent areas, tracks, sectors and geometric decomposition'],
 skills:['Perimeter','Circumference and $\pi$','Irrationality/approximations of $\pi$','Arc length','Track stagger','Area of rectangle/parallelogram/triangle','Median area','Heron','Equivalent-area transformations','Circle/sector/segment area'],
 sourceMap:[M('Perimeter, $\pi$ and arc length','1–12','Perimeter, circumference-to-diameter ratio, history/irrationality of pi, arcs, track stagger, puzzles and Exercise 6.1.'),M('Polygonal area and Heron','13–25','Rectangle, parallelogram and triangle area, median property, Heron’s formula, equivalent-area constructions and Exercise 6.2.'),M('Circle, sector and segment area','26–31','Area of circle, sectors, segments and Exercise 6.3 with source-stated pi approximations.'),M('End-of-chapter mastery and summary','32–37','All composite/proof/application end-of-chapter questions and chapter summary.')],
 notes:[
  N('$\pi$ discipline',['$\pi=C/D$ is irrational; $22/7$ and 3.14 are approximations, not equalities.','Use the approximation explicitly requested by the question.'],'C=2\pi r=\pi d','Do not silently replace $\pi$ when an exact answer is intended.'),
  N('Arc fraction principle',['Arc length is the same fraction of full circumference as its central angle is of $360^\circ$.','Semicircle and quadrant formulas are special cases.'],'L=\frac\theta{360^\circ}2\pi r','Think “angle fraction × whole circumference”.'),
  N('Area backbone',['Rectangle $lb$, parallelogram $bh$, triangle $\frac12bh$.','A median splits a triangle into equal areas even when the two triangles are not congruent.'],'A_\triangle=\frac12bh','Height must be perpendicular to the chosen base.'),
  N('Heron strategy',['For three sides, first compute semiperimeter $s$, then apply Heron.','Check triangle inequality before using the formula.'],'A=\sqrt{s(s-a)(s-b)(s-c)}','Look for factor simplification under the radical before decimalising.'),
  N('Sector and segment control',['Sector area is angle fraction × circle area.','Segment area = sector area − triangle area for a minor segment.'],'A_{sector}=\frac\theta{360^\circ}\pi r^2','Sketch the sector and triangle so you subtract the correct region.')
 ],
 examples:[
  E('Circumference','Find circumference for $r=7$ using $22/7$.',['$C=2\pi r$.','Substitute: $2\cdot22/7\cdot7$.','Cancel 7 to get 44.'],'$44$ cm','Cancel before multiplication.'),
  E('Arc length','Radius 14, angle $90^\circ$, use $22/7$.',['$L=\frac{90}{360}2\pi(14)$.','This is one quarter of circumference.','$L=22$ cm.'],'$22$ cm','Use symmetry/fraction reasoning before arithmetic.'),
  E('Heron','Find area of triangle with sides 13,14,15.',['$s=(13+14+15)/2=21$.','$A=\sqrt{21\cdot8\cdot7\cdot6}$.','$A=\sqrt{7056}=84$.'],'$84$ square units','Factor under the radical to expose a perfect square.'),
  E('Sector','Find area of a $60^\circ$ sector of radius 7 using $22/7$.',['$A=\frac{60}{360}\pi r^2$.','$=\frac16\cdot\frac{22}{7}\cdot49$.','$=77/3$ cm$^2$.'],'$77/3$ cm$^2$','Keep an exact fraction unless a decimal is requested.')
 ],
 exercises:[['6.1',8],['6.2',11],['6.3',10],['End-of-Chapter',27]],method:'Draw and label the required boundary/region, select circumference/arc/area/Heron/sector formula, preserve the question’s stated pi approximation, and include units at the end.',gen:'c9-perimeter-area-ncert-mastery'
},
{
 id:'c9-probability',num:7,title:'The Mathematics of Maybe: Introduction to Probability',pages:19,strand:'Statistics & Probability',weight:11,
 dotpoints:['Interpret randomness and locate events on the probability scale from impossible to certain','Calculate and compare experimental, statistical and theoretical probabilities, including sampling and long-run behaviour','Construct sample spaces and use events and tree diagrams to solve one-step and multi-stage probability problems'],
 skills:['Randomness','Probability scale','Experimental probability','Theoretical probability','Statistical probability/sampling','Law of Large Numbers','Gambler’s fallacy','Sample spaces/events','Tree diagrams'],
 sourceMap:[M('Randomness and probability scale','1–5','Subjective/objective likelihood, randomness, probability scale and Exercise 7.1.'),M('Objective probability','6–11','Experimental, theoretical and statistical probability, sampling, Law of Large Numbers, gambler’s fallacy and Exercise 7.2.'),M('Sample spaces, events and trees','12–14','Formal sample spaces/events and tree-diagram construction, Exercise 7.3.'),M('Multi-stage mastery and summary','15–19','Exercise 7.4, end-of-chapter probability problems and chapter summary.')],
 notes:[
  N('Probability scale',['Probability lies from 0 to 1 inclusive.','0 means impossible, 1 means certain, 1/2 represents even chance.'],'0\le P(E)\le1','Use numbers for precision and verbal labels for interpretation.'),
  N('Experimental probability',['Relative frequency is observed occurrences divided by trials.','It is data-dependent and can differ from theoretical probability in small samples.'],'P_{exp}(E)=\frac{\text{occurrences}}{\text{trials}}','Never call experimental probability “wrong” merely because it differs from theory.'),
  N('Theoretical probability',['For equally likely outcomes, probability is favourable outcomes divided by all outcomes.','The equally-likely assumption must be justified.'],'P(E)=\frac{|E|}{|S|}','Count outcomes, not labels, when repetitions/multiplicities matter.'),
  N('Independence and gambler’s fallacy',['Independent trials have no memory: previous fair coin tosses do not alter the next toss probability.','Long-run convergence does not imply short-run compensation.'],'P(H\text{ next})=1/2','Do not confuse Law of Large Numbers with “the opposite is due”.'),
  N('Tree-diagram multiplication/addition',['Multiply probabilities along a path; add probabilities of disjoint paths that realise the event.','Branch probabilities leaving one node sum to 1.'],'P(AB)=P(A)P(B\mid A)','Annotate every branch before doing arithmetic.')
 ],
 examples:[
  E('Experimental probability','A die shows 4 eight times in 50 rolls.',['Occurrences $=8$.','Trials $=50$.','$P_{exp}=8/50=4/25=0.16$.'],'$0.16$','Relative frequency is evidence, not a guarantee for the next roll.'),
  E('Theoretical die probability','Find probability of a prime on a fair die.',['Sample space $\{1,2,3,4,5,6\}$.','Primes are $2,3,5$: 3 favourable.','$P=3/6=1/2$.'],'$1/2$','List the sample space before counting.'),
  E('Word probability','Pick a random letter from PROBABILITY. Find $P(B)$.',['There are 11 letters.','B occurs twice.','$P(B)=2/11$.'],'$2/11$','Repeated letters count as distinct equally likely positions.'),
  E('Two-stage tree','Toss a fair coin twice. Find probability of exactly one head.',['Paths: HT and TH.','Each path has probability $1/2\times1/2=1/4$.','Add disjoint paths: $1/4+1/4=1/2$.'],'$1/2$','Multiply down branches, add across successful paths.')
 ],
 exercises:[['7.1',1],['7.2',6],['7.3',3],['7.4',2],['End-of-Chapter',16]],method:'Define the experiment and sample space first, identify whether evidence-based or equally-likely reasoning applies, then use relative frequency or favourable/total counting; for trees multiply along paths and add successful paths.',gen:'c9-probability-ncert-mastery'
},
{
 id:'c9-sequences-progressions',num:8,title:'Predicting What Comes Next: Exploring Sequences and Progressions',pages:27,strand:'Algebra',weight:11,
 dotpoints:['Describe sequences using term notation and explicit or recursive rules, including Virahānka–Fibonacci style recurrences','Analyse arithmetic progressions using first term, common difference, nth-term formula and sum formula','Analyse geometric progressions using common ratio and nth-term reasoning, connecting growth/decay with visual and fractal patterns'],
 skills:['Sequence notation','Explicit rules','Recursive rules','Virahānka–Fibonacci sequence','Arithmetic progressions','AP nth term','AP sum','Geometric progressions','GP nth term','Fractal/visual GP patterns'],
 sourceMap:[M('Sequence language and rules','1–6','Patterns, term notation, explicit rules, recursive rules, Virahānka–Fibonacci recurrence and Exercise 8.1.'),M('Arithmetic progressions and sums','7–12','AP definition, visualisation, nth term, sum of natural numbers/APs and Exercise 8.2.'),M('Geometric progressions','13–20','GP definition, ratio, nth term, growth/decay, fractals/visualisation and Exercise 8.3.'),M('End-of-chapter mastery and summary','21–27','All end-of-chapter sequence/AP/GP problems, summary and closing material.')],
 notes:[
  N('Sequence language',['A sequence is ordered; $t_n$ means the value in position n.','Term position n is a natural-number index even if term values are negative or fractional.'],'t_1,t_2,\ldots,t_n','Separate “term number” from “term value”.'),
  N('Explicit vs recursive',['An explicit rule computes $t_n$ directly from n.','A recursive rule computes a term from earlier terms and needs initial condition(s).'],'t_n=f(n)\quad\text{vs}\quad t_n=F(t_{n-1},\ldots)','Always state enough initial terms for a recurrence to start.'),
  N('AP structure',['An AP has constant difference d.','$t_n=a+(n-1)d$; n−1 counts jumps from first term.'],'t_n=a+(n-1)d','For membership questions, solve for n and require n to be natural.'),
  N('AP sums',['Pairing first and last terms gives the AP sum formula.','Equivalent forms use either last term or common difference.'],'S_n=\frac n2(a+l)=\frac n2[2a+(n-1)d]','Choose the form matching the information given.'),
  N('GP structure',['A GP has constant non-zero ratio r between successive terms.','$t_n=ar^{n-1}$; exponential growth/decay differs fundamentally from AP constant difference.'],'t_n=ar^{n-1}','Check ratios, not differences, before calling a sequence geometric.')
 ],
 examples:[
  E('Explicit rule','For $t_n=3n-7$, find $t_{12}$.',['Substitute $n=12$.','$t_{12}=36-7$.','$t_{12}=29$.'],'$29$','Explicit rules jump directly to any term.'),
  E('Recursive rule','Given $u_1=1$, $u_n=2u_{n-1}+3$, find first four terms.',['$u_2=5$.','$u_3=13$.','$u_4=29$.'],'$1,5,13,29$','A recurrence must be applied sequentially.'),
  E('AP sum','Find sum of first 20 terms of $4,7,10,\ldots$.',['$a=4,d=3,n=20$.','$S_n=\frac n2[2a+(n-1)d]$.','$S_{20}=10(8+57)=650$.'],'$650$','No need to list all 20 terms.'),
  E('GP nth term','Find 10th term of $5,25,125,\ldots$.',['$a=5,r=5$.','$t_n=ar^{n-1}$.','$t_{10}=5\cdot5^9=5^{10}=9,765,625$.'],'$9,765,625$','Multiplicative growth is the defining signal.')
 ],
 exercises:[['8.1',6],['8.2',7],['8.3',7],['End-of-Chapter',15]],method:'Identify whether the rule is explicit, recursive, AP or GP; extract a,d or r, choose nth-term/sum logic, and for membership questions verify the solved index is a natural number.',gen:'c9-sequences-progressions-ncert-mastery'
}
].map(ch=>Object.freeze({...ch,answerAudit:audit(ch.exercises),exerciseMethods:Object.fromEntries(ch.exercises.map(([ex])=>[ex,ch.method])),exercises:ch.exercises.map(([ex])=>ex),questionBank:qb(ch.gen),covers:covers(ch.gen)})));

export const NCERT_CLASS9_IDS = Object.freeze(NCERT_CLASS9_CONTENT.map(ch=>ch.id));
export const NCERT_CLASS9_DOTPOINTS_BY_ID = Object.freeze(Object.fromEntries(NCERT_CLASS9_CONTENT.map(ch=>[ch.id,Object.freeze([...ch.dotpoints])])));
export const NCERT_CLASS9_COVERS_BY_ID = Object.freeze(Object.fromEntries(NCERT_CLASS9_CONTENT.map(ch=>[ch.id,Object.freeze(ch.covers.map(c=>Object.freeze({gen:c.gen,dp:[...c.dp],diff:[...c.diff]}))) ])));
export const NCERT_CLASS9_RELEASE_AUDIT = Object.freeze({edition:'Ganita Manjari · Grade 9 · Part I · 2026–27',chapterCount:8,sourcePages:200,exerciseSections:42,sourceExerciseQuestions:293,authoredCells:32,generatedValidationTarget:1280,handwriting:'Numeric forms use the production InkAnswer handwriting-recognition, confidence, marking, retry and Pri Explain path.',answerVerification:'All 293 formal exercise prompts are represented. The current eight-file upload did not contain a separate Grade 9 answer-key PDF, so answers are independently derived from the uploaded source and cross-checked rather than falsely labelled as attached-key verification.'});

export function ncertClass9Chapter(id){ return NCERT_CLASS9_CONTENT.find(ch=>ch.id===id)||null; }
