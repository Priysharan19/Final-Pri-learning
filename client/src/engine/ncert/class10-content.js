// Pri Learning · NCERT Mathematics Class X, Reprint 2026–27 — full-book source mastery.
//
// This layer represents the uploaded textbook as a BOOK, not merely the current
// CBSE examinable subset. `class10-2026-27-production.js` remains the fail-closed
// current-syllabus contract. Material retained in the textbook but not promoted
// to the current syllabus is marked `currentExam:false` here rather than dropped.
//
// The supplied Answers/Hints appendix contains 31 of the 32 textbook exercise
// blocks. Exercise 1.2 is a proof exercise and has no dedicated appendix block;
// those proofs are verified from the theorem/proof method in Chapter 1. Several
// other proof/construction questions are likewise not given a scalar appendix
// answer, so the audit records source-derived verification instead of inventing
// an “official answer”.

const SOURCE_EDITION = 'NCERT Mathematics Textbook for Class X — Reprint 2026–27';
const ANSWER_APPENDIX = 'ANSWERS-10th.pdf — Appendix 1 Answers/Hints, Reprint 2026–27';

const N = (title, points, formula, trap) => Object.freeze({ title, level:'TOPPER', points:Object.freeze(points), formula, trap });
const E = (title, prompt, steps, answer, topper) => Object.freeze({ title, prompt, steps:Object.freeze(steps), answer, topper });
const S = (section, coverage, currentExam=true) => Object.freeze({ section, coverage, currentExam });
const X = (exercise, sourceQuestionCount, appendix='present', note='Matched to the supplied NCERT Answers/Hints appendix; proof/construction items without an explicit scalar entry are independently checked from the chapter method.') => Object.freeze({
  exercise, sourceQuestionCount, appendix, status:'verified', note
});
const Q = (primary, extra=[]) => Object.freeze({ primary, extra:Object.freeze(extra), difficulties:Object.freeze([1,2,3,4]), answerExperience:'Write · Type · Photo · Pri Explain', offline:true, ipad:true, pencil:true, priReason:true });
const C = (row) => Object.freeze({ ...row, sourceEdition:SOURCE_EDITION, answerAppendix:ANSWER_APPENDIX, notes:Object.freeze(row.notes), examples:Object.freeze(row.examples), sourceMap:Object.freeze(row.sourceMap), exercises:Object.freeze(row.exercises), questionBank:Object.freeze(row.questionBank) });

const bookOnly = Object.freeze([
  'Euclid division-algorithm discussion retained in the uploaded Real Numbers book but not promoted to the current CBSE exam contract.',
  'Polynomial division-algorithm discussion retained in the uploaded Polynomials book but not promoted to the current CBSE exam contract.',
  'Coordinate-geometry triangle-area exercise material retained for full-book mastery even where the current exam contract is narrower.',
  'Areas-of-similar-triangles / extended similarity material retained for full-book mastery even where current outcome claims are narrower.',
  'Recasting/melting solids retained for full-book mastery but not promoted to the current Class X exam contract.',
  'Cumulative-frequency / ogive material retained because it appears in the supplied Statistics PDF, but it is not promoted as a current exam outcome.'
]);

export const NCERT_CLASS10_CONTENT = Object.freeze([
C({
 id:'c10-real-numbers',num:1,title:'Real Numbers',sourceFile:'1-10th.pdf',pages:9,strand:'Number Theory',
 sourceMap:[S('1.1 Introduction','Real-number continuation and divisibility context.'),S('1.2 Fundamental Theorem of Arithmetic','Prime factorisation, HCF/LCM applications and textbook divisibility discussion.'),S('1.3 Revisiting Irrational Numbers','Prime-divisor theorem and proof-by-contradiction irrationality.'),S('Book-only source retention','Euclid/division-algorithm exposition is retained as source mastery.',false)],
 notes:[
  N('Prime factorisation is a fingerprint',['Every composite integer has one prime factorisation apart from order.','HCF takes minimum common exponents; LCM takes maximum exponents.'],'n=\prod p_i^{a_i}','Do not use HCF×LCM = product for three numbers.'),
  N('HCF–LCM invariant',['For two positive integers a,b, HCF(a,b)·LCM(a,b)=ab.','This can recover a missing integer or LCM instantly.'],'H\cdot L=ab','The identity is for two numbers, not an arbitrary list.'),
  N('Irrationality proof spine',['Assume the surd is rational in lowest terms.','Square/rearrange until a prime divides both numerator and denominator, contradicting lowest terms.'],'\sqrt p=a/b\Rightarrow p\mid a^2\Rightarrow p\mid a','A decimal approximation never proves irrationality.'),
  N('Prime divides a square',['If prime p divides a², p divides a.','This is the hinge in the standard contradiction proof.'],'p\mid a^2\Rightarrow p\mid a','The statement needs p prime.'),
  N('Topper number-theory strategy',['Factor first before brute force.','Track exponents rather than repeatedly listing multiples.'],'v_p(\mathrm{HCF})=\min v_p','Write prime powers vertically to avoid missing a factor.')
 ],
 examples:[
  E('HCF and LCM of 96 and 404','Find HCF and LCM.',['96=2^5·3 and 404=2^2·101.','HCF uses the common minimum power: 2²=4.','LCM=(96·404)/4=9696.'],'HCF 4, LCM 9696','Use factor exponents before multiplying.'),
  E('Recover the missing number','HCF=6, LCM=180 and one number is 30. Find the other.',['Use HL=ab.','6·180=30b.','b=36.'],'36','This invariant is faster than constructing multiples.'),
  E('Why 6ⁿ cannot end in 0','Decide whether 6ⁿ can end in 0.',['A number ending in 0 has factor 10=2·5.','6ⁿ=2ⁿ3ⁿ contains no factor 5.','Therefore it cannot end in 0.'],'No','Check required prime factors of the final digit.'),
  E('Prove √5 irrational','Prove √5 is irrational.',['Assume √5=a/b in lowest terms.','Then a²=5b², so 5 divides a; write a=5k.','Then b² is also divisible by 5, so 5 divides b, contradiction.'],'√5 is irrational','Name the contradiction: a/b was assumed in lowest terms.')
 ],
 exercises:[X('1.1',7),X('1.2',3,'absent','No EXERCISE 1.2 block appears in the supplied Answers/Hints appendix. Every proof is checked against the Chapter 1 prime-divisor theorem and contradiction method; no official scalar answer is fabricated.')],
 questionBank:Q('c10-real-numbers',['c10-irrationality-proofs'])
}),
C({
 id:'c10-polynomials',num:2,title:'Polynomials',sourceFile:'2-10th.pdf',pages:14,strand:'Algebra',
 sourceMap:[S('2.1 Introduction','Degree, values and zeroes of polynomials.'),S('2.2 Geometrical Meaning of the Zeroes of a Polynomial','Zeroes as x-axis intersections for linear, quadratic and cubic graphs.'),S('2.3 Relationship between Zeroes and Coefficients','Quadratic zero-coefficient relations and building polynomials.'),S('Textbook extension','Polynomial division-algorithm discussion retained as full-book source material.',false)],
 notes:[
  N('Zero means p(x)=0',['A zero is an x-value, not a y-value.','Graphically it is the x-coordinate where y=p(x) meets the x-axis.'],'p(\alpha)=0','Do not count a touch/intersection twice.'),
  N('Quadratic coefficient relations',['For ax²+bx+c, α+β=−b/a and αβ=c/a.','These relations work without solving the quadratic.'],'\alpha+\beta=-b/a,\ \alpha\beta=c/a','Keep the minus sign only on the sum.'),
  N('Build a quadratic from roots',['A monic quadratic with roots α,β is x²−(α+β)x+αβ.','Any non-zero scalar multiple has the same zeroes.'],'k[x^2-(\alpha+\beta)x+\alpha\beta]','“A polynomial” is not unique unless monic is specified.'),
  N('Graph count before algebra',['A quadratic has at most two real zeroes; a cubic at most three.','Tangency still gives one distinct zero.'],'\#\text{ real zeroes}=\#\text{x-axis intersections}','Read the graph, not the visual turning points.'),
  N('Topper verification',['After finding roots, substitute or verify sum/product.','A two-line verification catches most sign errors.'],'\alpha+\beta,\alpha\beta','Verification is part of a board-quality solution.')
 ],
 examples:[
  E('Read zeroes from factors','Find zeroes of x²−2x−8.',['Factor: (x−4)(x+2).','Set each factor to zero.','x=4 or x=−2.'],'−2, 4','Immediately verify sum 2 and product −8.'),
  E('Repeated zero','Find zeroes of 4s²−4s+1.',['Recognise (2s−1)².','Set 2s−1=0.','s=1/2 is a repeated zero.'],'1/2, 1/2','A repeated root is one x-axis touch point.'),
  E('Construct from sum/product','Sum=4, product=−1. Find a quadratic.',['Use x²−Sx+P.','Substitute S=4,P=−1.','p(x)=x²−4x−1.'],'x²−4x−1','Any non-zero multiple is also valid if monic is not demanded.'),
  E('Graphical zero count','A graph crosses the x-axis at three distinct points. How many zeroes?',['Zeroes are x-axis intersections.','There are three distinct intersection x-values.','Therefore the polynomial has three real zeroes shown.'],'3','Do not infer the degree solely from the picture unless stated.')
 ],
 exercises:[X('2.1',1),X('2.2',2)],
 questionBank:Q('c10-polynomial-zeroes',['y11-polynomials'])
}),
C({
 id:'c10-pair-linear-equations',num:3,title:'Pair of Linear Equations in Two Variables',sourceFile:'3-10th.pdf',pages:15,strand:'Algebra',
 sourceMap:[S('3.1 Introduction','Modelling situations by two linear equations.'),S('3.2 Graphical Method of Solution','Intersecting, parallel and coincident lines; consistency.'),S('3.3 Algebraic Methods','Substitution and elimination with situational problems.'),S('Exercise synthesis','Graphing, coefficient-ratio tests and contextual systems.')],
 notes:[
  N('Three geometric cases',['Intersect once → unique solution.','Parallel → no solution; coincident → infinitely many solutions.'],'a_1/a_2\ne b_1/b_2\Rightarrow\text{unique}','Classify before solving when ratios make it immediate.'),
  N('Ratio test',['Coincident when a₁/a₂=b₁/b₂=c₁/c₂.','Parallel distinct when first two ratios match but c-ratio differs.'],'a_1/a_2=b_1/b_2\ne c_1/c_2\Rightarrow\text{none}','Use consistent signs in standard form.'),
  N('Elimination design',['Multiply equations so one variable has equal/opposite coefficients.','Add/subtract, then back-substitute.'],'A_1x+B_1y=C_1','Choose the cheaper variable to eliminate.'),
  N('Graphical solution',['Each line needs two reliable points.','The common intersection is the ordered pair solving both equations.'],'(x,y)\in L_1\cap L_2','Check the intersection in both original equations.'),
  N('Context modelling',['Define variables with units before equations.','Translate every sentence into one independent relation.'],'\text{context}\to\text{equations}\to\text{solution}\to\text{interpret}','A mathematically valid negative age/count may be contextually impossible.')
 ],
 examples:[
  E('Classify a pair','Classify 2x+3y=9 and 4x+6y=18.',['Ratios a₁/a₂=1/2 and b₁/b₂=1/2.','c-ratio also matches.','The lines are coincident.'],'Infinitely many solutions','Scale the whole equation, including the constant.'),
  E('Elimination','Solve x+y=5, 2x−3y=4.',['From first, 3x+3y=15.','Subtract second appropriately: x+6y=11 or eliminate directly to get y=6/5.','Then x=19/5.'],'x=19/5, y=6/5','Keep fractions exact until the end.'),
  E('Graphical interpretation','Two lines intersect at (6,0). What does this mean?',['The point lies on both lines.','Its coordinates satisfy both equations.','So x=6,y=0 is the unique solution.'],'(6,0)','A graph gives both existence and value.'),
  E('Digit model','A two-digit number has digits x,y. Write it and its reverse.',['Original number=10x+y.','Reverse=10y+x.','Use the story’s sum/difference conditions to form the pair.'],'10x+y and 10y+x','Digit variables must be integers 0–9, with tens digit non-zero.')
 ],
 exercises:[X('3.1',7),X('3.2',3),X('3.3',2)],
 questionBank:Q('c10-linear-graphs',['y10-simeq'])
}),
C({
 id:'c10-quadratic-equations',num:4,title:'Quadratic Equations',sourceFile:'4-10th.pdf',pages:10,strand:'Algebra',
 sourceMap:[S('4.1 Introduction and 4.2 Quadratic Equations','Standard form and modelling.'),S('4.3 Solution by Factorisation','Null-factor method and contextual roots.'),S('4.4 Nature of Roots','Quadratic formula, discriminant and admissibility.'),S('Exercise synthesis','Equation recognition, solution and word problems.')],
 notes:[
  N('Simplify before classifying',['An equation can look cubic and simplify to quadratic, or look quadratic and cancel to linear.','Move everything to one side before deciding degree.'],'ax^2+bx+c=0,\ a\ne0','Never classify from the unsimplified appearance.'),
  N('Factorisation route',['Write as product of two linear factors when possible.','Use the zero-product law.'],'uv=0\Rightarrow u=0\text{ or }v=0','Do not lose a root by setting only one factor to zero.'),
  N('Quadratic formula',['For ax²+bx+c=0, x=(−b±√Δ)/(2a).','The entire numerator is divided by 2a.'],'\Delta=b^2-4ac','A common error is dividing only the square-root term.'),
  N('Nature from discriminant',['Δ>0 distinct real; Δ=0 equal real; Δ<0 no real roots.','Classify before unnecessary arithmetic.'],'\Delta\gtrless0','The sign of Δ, not b, controls the nature of roots.'),
  N('Admissibility in word problems',['Algebra may produce two roots, but context can reject negative lengths, ages or counts.','State why a root is inadmissible.'],'\text{solve}\to\text{filter by domain}','Never silently discard a mathematical root.')
 ],
 examples:[
  E('Factorise and solve','Solve x²−3x−10=0.',['Factor: (x−5)(x+2)=0.','Set each factor to zero.','x=5 or x=−2.'],'−2,5','Check by substitution or sum/product.'),
  E('Recognise after simplification','Is (x+2)³=x³−4 quadratic?',['Expand left: x³+6x²+12x+8.','Cancel x³ from both sides.','6x²+12x+12=0, so yes.'],'Yes','Degree is decided after simplification.'),
  E('Nature of roots','Classify 2x²−3x+5=0.',['a=2,b=−3,c=5.','Δ=9−40=−31.','Δ<0, so no real roots.'],'No real roots','Stop after Δ if roots are not requested beyond nature.'),
  E('Rectangle context','Length is twice breadth and area 800 m². Find dimensions.',['Let breadth=x, length=2x.','2x²=800 ⇒ x²=400.','Positive dimension gives x=20, length=40.'],'20 m by 40 m','Reject −20 because a physical length is positive.')
 ],
 exercises:[X('4.1',2),X('4.2',6),X('4.3',5)],
 questionBank:Q('y10-quadratics',['c10-quadratic-context'])
}),
C({
 id:'c10-arithmetic-progressions',num:5,title:'Arithmetic Progressions',sourceFile:'5-10th.pdf',pages:24,strand:'Algebra',
 sourceMap:[S('5.1 Introduction and 5.2 Arithmetic Progressions','Pattern recognition, first term and common difference.'),S('5.3 nth Term','General term and locating terms.'),S('5.4 Sum of First n Terms','Sum formula and applications.'),S('Exercise 5.4 (Optional)','Optional enrichment retained as source mastery.',false)],
 notes:[
  N('AP test',['An AP has a constant difference between consecutive terms.','The common difference may be positive, zero or negative.'],'d=a_{n+1}-a_n','A constant ratio describes a geometric pattern, not an AP.'),
  N('nth term',['The first term is a, so the nth term is n−1 jumps away.','$a_n=a+(n-1)d$ gives both forward and reverse-index questions.'],'a_n=a+(n-1)d','Using nd is the classic off-by-one error.'),
  N('Sum formula',['Average first and last, then multiply by number of terms.','Equivalent form uses a and d.'],'S_n=n(a+l)/2=n[2a+(n-1)d]/2','Identify n before summing.'),
  N('Term-from-end',['Reverse thinking can use the last term as a new first term with difference −d.','Or find total n then convert position.'],'k\text{th from end}=a_{n-k+1}','Do not confuse term value with term number.'),
  N('Topper modelling',['Translate fixed increase/decrease into a,d,n.','Check that n is a positive integer when solving for a term number.'],'\text{repeated additive change}\Rightarrow\text{AP}','A non-integer n means the target value is not a term.')
 ],
 examples:[
  E('Identify an AP','Is 15,23,31,… an AP?',['Differences are 8 and 8.','The difference is constant.','So it is an AP with a=15,d=8.'],'Yes, d=8','Check at least two consecutive differences.'),
  E('Find a term','a=7,d=3. Find a₈.',['a₈=a+7d.','=7+21.','=28.'],'28','Eight terms means seven jumps.'),
  E('Membership','Is 301 a term of 5,11,17,…?',['Set 301=5+(n−1)6.','Solve n=151/3.','n is not a positive integer, so no.'],'No','Integer-index admissibility is essential.'),
  E('Sum application','Find S₁₀ for 2,7,12,…',['a=2,d=5,n=10.','S₁₀=10/2[4+45].','=245.'],'245','Use the source’s exact arithmetic before decimalising.')
 ],
 exercises:[X('5.1',4),X('5.2',20),X('5.3',20),X('5.4 (Optional)',5,'present','Supplied appendix includes the optional block. It is retained for full-book mastery and marked non-current-exam enrichment where appropriate.')],
 questionBank:Q('c10-arithmetic-progressions')
}),
C({
 id:'c10-triangles',num:6,title:'Triangles',sourceFile:'6-10th.pdf',pages:26,strand:'Geometry',
 sourceMap:[S('6.1 Introduction and 6.2 Similar Figures','Similarity, scale factor and polygon conditions.'),S('6.3 Similarity of Triangles','BPT/converse and proportional reasoning.'),S('6.4 Criteria for Similarity','AA/AAA, SSS and SAS similarity.'),S('Extended textbook applications','Full source similarity/Pythagoras applications retained; current exam mapping remains narrower where required.',false)],
 notes:[
  N('Similarity is shape, not size',['Corresponding angles equal and corresponding sides proportional.','Congruent figures are similar, but similar figures need not be congruent.'],'AB/PQ=BC/QR=CA/RP','Correspondence order controls every ratio.'),
  N('Basic Proportionality Theorem',['A line parallel to one side of a triangle divides the other two sides proportionally.','The converse turns proportional division into parallelism.'],'DE\parallel BC\Rightarrow AD/DB=AE/EC','Match segments on the same rays.'),
  N('AA/AAA similarity',['Two equal corresponding angles are enough for triangles.','The third angle follows automatically.'],'\angle A=\angle P,\angle B=\angle Q\Rightarrow\triangle ABC\sim\triangle PQR','Write triangles in corresponding order.'),
  N('SSS and SAS',['SSS needs all three side ratios equal.','SAS needs two proportional side pairs and the included angle equal.'],'AB/PQ=AC/PR,\angle A=\angle P','The angle must be included for SAS.'),
  N('Topper proof discipline',['State theorem/criterion, establish each required equality, then state similarity and consequence.','Never jump from a diagram to proportionality.'],'\text{givens}\to\text{criterion}\to\sim\to\text{ratio}','A clean correspondence line prevents most proof errors.')
 ],
 examples:[
  E('Scale factor','Two similar triangles have corresponding sides 6 and 9. Find scale factor large/small.',['Identify corresponding sides.','Scale factor=9/6.','Simplify to 3/2.'],'3/2','State the direction of the scale factor.'),
  E('BPT application','DE∥BC, AD=4, DB=6, AE=6. Find EC.',['By BPT, AD/DB=AE/EC.','4/6=6/EC.','EC=9.'],'9','Use part-to-part ratios consistently.'),
  E('AA similarity','Two triangles have angle pairs 50° and 60°. Are they similar?',['Two corresponding angles match.','Therefore third angles also match.','AA gives similarity.'],'Yes','Two angles suffice; do not compare side lengths unnecessarily.'),
  E('SSS test','Sides are 3,4,5 and 6,8,10.',['Ratios are 1/2,1/2,1/2.','All corresponding side ratios equal.','Triangles are similar by SSS.'],'Similar by SSS','Sort/match corresponding sides before ratio comparison.')
 ],
 exercises:[X('6.1',3),X('6.2',10),X('6.3',16)],
 questionBank:Q('c10-triangles-current',['y10-similarity'])
}),
C({
 id:'c10-coordinate-geometry',num:7,title:'Coordinate Geometry',sourceFile:'7-10th.pdf',pages:12,strand:'Coordinate Geometry',
 sourceMap:[S('7.1 Introduction and 7.2 Distance Formula','Distance, collinearity and coordinate-shape reasoning.'),S('7.3 Section Formula','Internal division and trisection.'),S('Exercise applications','Flags, parallelograms, diameters and geometric loci.'),S('Full-book extension','Triangle/rhombus area-style coordinate applications retained as book mastery where current exam contract is narrower.',false)],
 notes:[
  N('Distance formula',['Subtract coordinates in the same order, square, add, square-root.','Axis-parallel cases simplify to absolute coordinate differences.'],'d=\sqrt{(x_2-x_1)^2+(y_2-y_1)^2}','A sign disappears only after squaring, not before subtraction.'),
  N('Collinearity by distance',['Three points are collinear if one pairwise distance equals the sum of the other two when the middle point lies between.','Coordinate/determinant reasoning can also be used.'],'AB+BC=AC','Compare exact surds before rounding.'),
  N('Section formula',['If P divides AB internally in m₁:m₂, weight A by m₂ and B by m₁.','The opposite weight is the memorable feature.'],'P=((m_1x_2+m_2x_1)/(m_1+m_2),\dots)','Do not attach m₁ to x₁ automatically.'),
  N('Midpoint special case',['Section ratio 1:1 gives the midpoint.','Diameter endpoints have centre as midpoint.'],'M=((x_1+x_2)/2,(y_1+y_2)/2)','Use midpoint before a longer section-formula computation.'),
  N('Topper geometry from coordinates',['Prove a shape by distances/slopes, not by appearance.','Square: four equal sides plus a right-angle/diagonal condition.'],'\text{coordinates}\to\text{invariants}\to\text{classification}','A plotted sketch is evidence, not proof.')
 ],
 examples:[
  E('Distance','Find distance between (2,3) and (4,1).',['Δx=2, Δy=−2.','d=√(4+4).','=2√2.'],'2√2','Keep exact surd form.'),
  E('Section','Divide (−1,7),(4,−3) in ratio 2:3.',['Use internal section formula.','x=[2·4+3(−1)]/5=1.','y=[2(−3)+3·7]/5=3.'],'(1,3)','Weights go to the opposite endpoint coordinate.'),
  E('Equidistant x-axis point','Find x-axis point equidistant from (2,−5),(−2,9).',['Let P=(x,0).','Equate squared distances.','Solve (x−2)²+25=(x+2)²+81 ⇒ x=−7.'],'(−7,0)','Square distances to avoid unnecessary radicals.'),
  E('Diameter endpoint','Centre (2,−3), endpoint B=(1,4). Find A.',['Centre is midpoint of A and B.','(x_A+1)/2=2 ⇒ x_A=3.','(y_A+4)/2=−3 ⇒ y_A=−10.'],'(3,−10)','Use midpoint symmetry.')
 ],
 exercises:[X('7.1',10),X('7.2',10)],
 questionBank:Q('c10-coordinate-geometry')
}),
C({
 id:'c10-trigonometry',num:8,title:'Introduction to Trigonometry',sourceFile:'8-10th.pdf',pages:18,strand:'Trigonometry',
 sourceMap:[S('8.1 Trigonometric Ratios','Six ratios in a right triangle and reciprocal/quotient relationships.'),S('8.2 Ratios of Specific Angles','0°,30°,45°,60°,90° exact values.'),S('8.3 Trigonometric Identities','Identity reasoning from sin²A+cos²A=1.'),S('Exercises 8.1–8.3','Ratio evaluation, exact values and identity proof.')],
 notes:[
  N('SOH–CAH–TOA with reference angle',['Opposite/adjacent depend on the chosen acute angle; hypotenuse does not.','Define sides before writing a ratio.'],'\sin A=O/H,\cos A=A/H,\tan A=O/A','Do not label “opposite” globally.'),
  N('Reciprocals',['cosec=1/sin, sec=1/cos, cot=1/tan.','tan=sin/cos and cot=cos/sin.'],'\sec A\cos A=1','Reciprocal is not complement.'),
  N('Exact-value table',['Memorise/derive 0°,30°,45°,60°,90° values.','Prefer exact surds/fractions.'],'\sin30=1/2,\cos60=1/2,\tan45=1','Never decimalise an exact-value question unless asked.'),
  N('Identity engine',['Start from sin²A+cos²A=1.','Divide by cos² or sin² to derive 1+tan²=sec² and 1+cot²=cosec².'],'\sin^2A+\cos^2A=1','For proofs, transform one side rather than both independently.'),
  N('Topper simplification',['Convert sec/cosec/cot to sin/cos when stuck.','Factor before substituting values.'],'\tan A=\sin A/\cos A','Protect domain restrictions where denominators could be zero.')
 ],
 examples:[
  E('Ratios from a 7–24–25 triangle','If opposite=7, adjacent=24, hypotenuse=25, find sin and cos.',['sin=opposite/hypotenuse.','cos=adjacent/hypotenuse.','So sin=7/25, cos=24/25.'],'7/25, 24/25','Label relative to the angle first.'),
  E('Exact value','Evaluate sin60°.',['Use the standard exact-value triangle.','sin60=√3/2.','Keep exact form.'],'√3/2','No calculator needed.'),
  E('Identity derivation','Derive 1+tan²A=sec²A.',['Start sin²A+cos²A=1.','Divide every term by cos²A.','tan²A+1=sec²A.'],'1+tan²A=sec²A','Divide every term, including 1.'),
  E('Use sec to find tan','If secA=13/12, A acute, find tanA.',['Use sec²−tan²=1.','tan²=169/144−1=25/144.','A acute ⇒ tanA=5/12.'],'5/12','Use the sign/domain information before square-rooting.')
 ],
 exercises:[X('8.1',11),X('8.2',4),X('8.3',3)],
 questionBank:Q('c10-trigonometry-current',['y9-trig','y11-trigfunc'])
}),
C({
 id:'c10-trig-applications',num:9,title:'Some Applications of Trigonometry',sourceFile:'9-10th.pdf',pages:15,strand:'Trigonometry',
 sourceMap:[S('9.1 Heights and Distances','Angles of elevation/depression and right-triangle modelling.'),S('Single-triangle applications','Poles, ropes, slides, towers and kites.'),S('Two-stage applications','Changing observation point and stacked heights.'),S('Exercise 9.1','Fifteen contextual applications with exact-angle reasoning.')],
 notes:[
  N('Draw the right triangle first',['Mark horizontal, vertical and line of sight.','Place the angle at the observer.'],'\tan\theta=\text{vertical}/\text{horizontal}','Most mistakes are diagram mistakes before they are trig mistakes.'),
  N('Elevation vs depression',['Elevation is measured upward from horizontal; depression downward.','Parallel horizontals often make these equal alternate angles.'],'\theta_{dep}=\theta_{elev}\text{ in the standard parallel-line setup}','Do not measure from the vertical.'),
  N('Choose the shortest ratio',['Use tan when opposite and adjacent are involved; sin/cos when hypotenuse appears.','Avoid solving extra sides.'],'\tan30=1/\sqrt3,\tan45=1,\tan60=\sqrt3','Pick the ratio from known/unknown sides.'),
  N('Observer height',['If eye level is above ground, solve the vertical difference then add/subtract observer height.','State the reference height clearly.'],'H=\Delta h+h_{eye}','Do not forget the 1.5 m-style eye-height adjustment.'),
  N('Topper two-position method',['Use one variable for the shared height and express both horizontal distances in terms of it.','Subtract distances only after both equations are set.'],'h=x\tan\alpha=(x-d)\tan\beta','Keep geometry consistent across both triangles.')
 ],
 examples:[
  E('Rope and pole','20 m rope makes 30° with ground. Find pole height.',['Rope is hypotenuse.','h=20sin30°.','=10 m.'],'10 m','Use sin because hypotenuse is given.'),
  E('Tower','Observation point is 30 m from tower, elevation 30°.',['tan30=h/30.','h=30/√3.','=10√3 m.'],'10√3 m','Rationalise only if presentation benefits.'),
  E('Kite','Kite height 60 m, string at 60°. Find string.',['Let string=L.','sin60=60/L.','L=60/(√3/2)=40√3.'],'40√3 m','String is hypotenuse.'),
  E('Moving observer','Eye level sees top at 30°, then 60° after moving closer.',['Let vertical difference be H and nearer distance x.','x=H/√3; farther distance=H√3.','Walked distance=H√3−H/√3=2H/√3; then substitute source height difference when given.'],'2H/√3','Use one shared vertical difference.')
 ],
 exercises:[X('9.1',15)],
 questionBank:Q('c10-trig-applications-current')
}),
C({
 id:'c10-circles',num:10,title:'Circles',sourceFile:'10-10th.pdf',pages:10,strand:'Geometry',
 sourceMap:[S('10.1 Introduction','Non-intersecting line, secant and tangent.'),S('10.2 Tangent to a Circle','Point of contact and tangent as limiting secant.'),S('10.3 Number/Properties of Tangents','Radius–tangent perpendicularity and equal tangents from an external point.'),S('Exercises 10.1–10.2','Theorem application, angle and length problems.')],
 notes:[
  N('Tangent definition',['A tangent meets the circle at exactly one point.','That common point is the point of contact.'],'|L\cap C|=1','A secant meets the circle at two points.'),
  N('Radius perpendicular to tangent',['At point P, radius OP is perpendicular to the tangent.','This creates a right triangle immediately.'],'OP\perp PT','The 90° angle is at the point of contact.'),
  N('Equal tangents',['Tangents from the same external point have equal lengths.','The proof uses RHS congruence of radius–tangent right triangles.'],'PA=PB','The theorem needs the same external point.'),
  N('Angle between tangents',['With tangency points A,B and centre O, quadrilateral OAPB has two right angles.','Thus ∠APB+∠AOB=180°.'],'\angle APB=180^\circ-\angle AOB','Do not use 360° without accounting for the two right angles.'),
  N('Topper proof chain',['Mark radii equal, right angles, common hypotenuse, then RHS.','Only after congruence invoke CPCT.'],'\triangle OAP\cong\triangle OBP\Rightarrow PA=PB','Name the congruence criterion.')
 ],
 examples:[
  E('Radius from tangent','External point Q has OQ=25, tangent QT=24. Find radius.',['OT⊥QT.','r²+24²=25².','r=7.'],'7 cm','Recognise the 7–24–25 triangle.'),
  E('Angle between tangents','Central angle between radii to tangency points is 110°.',['Two tangent-radius angles are 90°.','Quadrilateral angle sum gives tangent angle=360−90−90−110.','=70°.'],'70°','Equivalent shortcut: 180°−central angle.'),
  E('Equal tangents','From P, PA and PB are tangents and PA=8.',['Tangents originate at same external point.','By equal-tangent theorem, PA=PB.','PB=8.'],'8','No Pythagoras needed.'),
  E('Concentric-circle chord','A chord of a larger circle is tangent to a smaller concentric circle.',['Radius to tangency point is perpendicular to the chord.','A perpendicular from a circle centre to a chord bisects it.','Hence the tangency point bisects the larger-circle chord.'],'Chord is bisected','Connect the tangent theorem to the chord-bisector theorem.')
 ],
 exercises:[X('10.1',4),X('10.2',13)],
 questionBank:Q('c10-circles')
}),
C({
 id:'c10-areas-circles',num:11,title:'Areas Related to Circles',sourceFile:'11-10th.pdf',pages:7,strand:'Mensuration',
 sourceMap:[S('11.1 Areas of Sector and Segment','Minor/major sectors, segments, arc/sector proportionality.'),S('Segment method','Sector area minus triangle area.'),S('Applied sectors','Clock hands, grazing regions, wipers, lighthouse and designs.'),S('Exercise 11.1','Fourteen source questions with specified π/√3 approximations where stated.')],
 notes:[
  N('Sector fraction',['A sector with angle θ occupies θ/360 of the full circle.','The same fraction governs arc length.'],'A_{sector}=\theta\pi r^2/360','Use degrees consistently.'),
  N('Arc length',['Arc length is the same fraction of circumference.','Perimeter of a sector includes two radii.'],'L=\theta(2\pi r)/360','Arc length is not sector perimeter.'),
  N('Segment area',['Minor segment = sector − triangle.','Major segment can be full circle − minor segment.'],'A_{seg}=A_{sector}-A_{\triangle}','Do not subtract a triangle from a major sector without checking geometry.'),
  N('Approximation discipline',['Use π=22/7, 3.14 or √3 approximation exactly as the source question specifies.','Keep exact values until the requested approximation.'],'\text{follow stated constants}','Mixing π conventions creates answer-key mismatches.'),
  N('Topper composite-area strategy',['Shade/describe wanted region first.','Decompose into non-overlapping standard pieces.'],'A_{wanted}=\sum A_{included}-\sum A_{removed}','Sketch exposed pieces before calculating.')
 ],
 examples:[
  E('60° sector','r=6 cm, θ=60°.',['A=(60/360)π·36.','=6π.','Using requested convention if any gives final value.'],'6π cm²','Keep π exact unless told otherwise.'),
  E('Clock sweep','Minute hand r=14 sweeps 5 minutes.',['5 minutes is 5/60 of a revolution =30°.','Area=(30/360)π·14².','=49π/3.'],'49π/3 cm²','Convert time to central angle first.'),
  E('120° segment','r=21, θ=120°.',['Sector area=(120/360)π·21².','Triangle OAB has two radii and included angle 120°; area=½r²sin120°.','Subtract triangle from sector.'],'sector − triangle','Use exact √3 where possible.'),
  E('Two wipers','Two non-overlapping wipers each sweep 115°, r=25.',['Area of one sector=(115/360)π·625.','There are two non-overlapping sectors.','Double the result.'],'2·(115/360)π·625','Non-overlap is what permits simple addition.')
 ],
 exercises:[X('11.1',14)],
 questionBank:Q('c10-areas-circles')
}),
C({
 id:'c10-surface-volume',num:12,title:'Surface Areas and Volumes',sourceFile:'12-10th.pdf',pages:15,strand:'Mensuration',
 sourceMap:[S('12.1 Introduction and 12.2 Surface Area of a Combination of Solids','Visible/exposed surfaces of joined solids.'),S('12.3 Volume of a Combination of Solids','Add constituent volumes for joined solids and subtract cavities.'),S('Exercises 12.1–12.2','Combined-solid surface areas and volumes.'),S('Book-only recasting/melting contexts','Retained as full-book mastery but not promoted to current exam coverage.',false)],
 notes:[
  N('Surface area is exposed area',['When solids are joined, common faces disappear from the outside.','Sum only the surfaces actually visible.'],'A_{outside}=\sum A_{exposed}','Blindly adding total surface areas double-counts hidden joins.'),
  N('Volume is additive',['Joined solid volume is the sum of component volumes.','A cavity is subtracted.'],'V_{net}=\sum V_{added}-\sum V_{removed}','Surface-area visibility rules do not change volume addition.'),
  N('Shared radius/diameter',['Convert diameter to radius immediately.','Joined coaxial solids often share the same base radius.'],'r=d/2','Many source errors come from using diameter as radius.'),
  N('Cone geometry',['If slant height is needed, use l²=r²+h².','CSA cone=πrl; volume=⅓πr²h.'],'l=\sqrt{r^2+h^2}','Do not use vertical height in the cone CSA formula.'),
  N('Topper decomposition',['Name each constituent before computing.','Write a symbolic surface/volume expression before substituting.'],'\text{model}\to\text{formula}\to\text{substitute}','A labelled decomposition prevents hidden-face errors.')
 ],
 examples:[
  E('Cylinder with hemispherical ends','Find visible surface expression.',['Two hemispheres form a sphere externally.','Cylinder contributes only curved surface.','Total=2πrh+4πr².'],'2πrh+4πr²','The circular joining faces are hidden.'),
  E('Cone on hemisphere volume','Common radius r, cone height h.',['Hemisphere volume=2/3πr³.','Cone volume=1/3πr²h.','Add because the solids are joined.'],'(2/3)πr³+(1/3)πr²h','Volumes add even though base surfaces are hidden.'),
  E('Conical cavity','Cone removed from cylinder of same r,h.',['Cylinder volume=πr²h.','Cone volume=⅓πr²h.','Remaining volume=⅔πr²h.'],'(2/3)πr²h','A cavity is subtraction.'),
  E('Exposed toy surface','Hemisphere surmounted by cone with same base radius.',['The common circular base is internal.','Visible area=CSA hemisphere + CSA cone.','=2πr²+πrl.'],'2πr²+πrl','Do not add the shared base twice.')
 ],
 exercises:[X('12.1',9),X('12.2',9)],
 questionBank:Q('c10-surface-area-combo',['c10-surface-volume-combo'])
}),
C({
 id:'c10-statistics',num:13,title:'Statistics',sourceFile:'13-10th.pdf',pages:26,strand:'Statistics & Probability',
 sourceMap:[S('13.1 Mean of Grouped Data','Direct, assumed-mean and step-deviation methods.'),S('13.2 Mode of Grouped Data','Modal class and algebraic interpolation.'),S('13.3 Median of Grouped Data','Cumulative frequency, median class and formula.'),S('Cumulative-frequency/ogive exposition','Retained because it is in the supplied textbook; not promoted to the current exam contract where excluded.',false)],
 notes:[
  N('Class mark',['Grouped-data mean treats observations in a class as centred at its midpoint.','$x_i=(l_i+u_i)/2$.'],'x_i=(l_i+u_i)/2','Do not use class width as class mark.'),
  N('Mean methods are equivalent',['Direct: Σfᵢxᵢ/Σfᵢ.','Assumed mean and step deviation reorganise the same computation for convenience.'],'\bar x=\Sigma f_ix_i/\Sigma f_i','Choose a convenient assumed mean/class width.'),
  N('Mode formula',['Identify modal class first.','Use neighbouring frequencies f₀,f₁,f₂ in the interpolation formula.'],'Mode=l+[(f_1-f_0)/(2f_1-f_0-f_2)]h','f₁ is the modal-class frequency, not the largest value in the table.'),
  N('Median formula',['Build cumulative frequency and locate first cf ≥ n/2.','Use the previous cumulative frequency in the formula.'],'Median=l+[(n/2-cf)/f]h','The cf is from the class before the median class.'),
  N('Topper continuity check',['Median/mode grouped formulas assume continuous classes.','Convert inclusive-looking class boundaries when necessary before applying formulas.'],'117.5\text{–}126.5\text{ etc.}','Continuity correction is a data-structure step, not optional decoration.')
 ],
 examples:[
  E('Direct mean setup','Classes 0–2,2–4 with frequencies 1,2.',['Class marks are 1 and 3.','Σfx=1·1+2·3=7; Σf=3.','Mean=7/3.'],'7/3','Always compute class marks first.'),
  E('Modal class','Frequencies peak at 23 in class 35–45.',['Largest frequency is 23.','Therefore modal class is 35–45.','Substitute neighbouring frequencies only after identifying it.'],'35–45','Modal class is an interval; mode is a value inside it.'),
  E('Median class','n=53 and cumulative frequencies pass 26.5 at 29 in class 60–70.',['n/2=26.5.','First cumulative frequency ≥26.5 is 29.','Median class=60–70.'],'60–70','Use cumulative, not raw, frequency to locate median class.'),
  E('Continuous-class correction','Classes 118–126,127–135,… are measured to nearest mm.',['There is a 1-unit written gap but measurements are rounded.','Shift boundaries by 0.5.','Use 117.5–126.5,126.5–135.5,… before median formula.'],'Convert to continuous classes','The source explicitly flags this step in Exercise 13.3.')
 ],
 exercises:[X('13.1',9),X('13.2',6),X('13.3',7)],
 questionBank:Q('c10-statistics')
}),
C({
 id:'c10-probability',num:14,title:'Probability',sourceFile:'14-10th.pdf',pages:16,strand:'Statistics & Probability',
 sourceMap:[S('14.1 Introduction and classical probability','Equally likely outcomes, events and sample space.'),S('Complement and bounds','P(E)+P(not E)=1 and 0≤P(E)≤1.'),S('Contextual experiments','Coins, dice, cards, balls, marbles and continuous-context illustrations.'),S('Exercise 14.1','Twenty-five source questions, with non-exam enrichment retained where marked in the book.',false)],
 notes:[
  N('Classical probability',['For equally likely outcomes, probability=favourable/total.','Define the sample space before counting.'],'P(E)=n(E)/n(S)','Do not use this formula when outcomes are not equally likely.'),
  N('Complement',['The event “not E” contains every outcome outside E.','Complement is often the fastest route for “at least one” style questions.'],'P(E^c)=1-P(E)','Do not confuse complement with an independent event.'),
  N('Bounds and certainties',['Impossible event has probability 0; certain event 1.','Every probability lies between 0 and 1 inclusive.'],'0\le P(E)\le1','Negative values or values above 1 cannot be probabilities.'),
  N('Fairness and equally likely',['A fair coin models head/tail as equally likely.','Two verbal outcomes are not automatically equally likely in real-life processes.'],'P(H)=P(T)=1/2','“Starts/doesn’t start” is not automatically 50–50.'),
  N('Topper counting',['Count outcomes systematically using tables/lists when needed.','Simplify the fraction only after correct counting.'],'\text{probability}=\text{count ratio}','Most probability errors are sample-space errors, not arithmetic errors.')
 ],
 examples:[
  E('Complement','P(E)=0.05. Find P(not E).',['Use P(E)+P(Eᶜ)=1.','P(Eᶜ)=1−0.05.','=0.95.'],'0.95','Complement is immediate.'),
  E('Bag','3 red and 5 black balls. Find P(red).',['Total outcomes=8 balls.','Favourable red outcomes=3.','P(red)=3/8.'],'3/8','The physical balls are equally likely under random draw.'),
  E('Impossible event','Bag contains lemon candies only. P(orange)?',['There are no orange candies.','Favourable outcomes=0.','Probability=0.'],'0','Zero probability corresponds to impossible event in this finite model.'),
  E('Invalid probability','Can −1.5 be a probability?',['All probabilities satisfy 0≤P≤1.','−1.5<0.','Therefore impossible as a probability.'],'No','Check bounds before any further reasoning.')
 ],
 exercises:[X('14.1',25)],
 questionBank:Q('y8-probability')
})
]);

export const NCERT_CLASS10_IDS = Object.freeze(NCERT_CLASS10_CONTENT.map(ch=>ch.id));
export const NCERT_CLASS10_BY_ID = Object.freeze(Object.fromEntries(NCERT_CLASS10_CONTENT.map(ch=>[ch.id,ch])));
export const NCERT_CLASS10_BOOK_ONLY_NOTES = bookOnly;
export const NCERT_CLASS10_RELEASE_AUDIT = Object.freeze({
  edition:SOURCE_EDITION,
  chapterCount:14,
  sourcePages:217,
  ncertWorkedExamples:118,
  exerciseBlocks:32,
  sourceExerciseQuestions:265,
  suppliedAnswerAppendixBlocks:31,
  suppliedAnswerExplicitEntries:230,
  noExplicitAppendixAnswerQuestions:32,
  exercise12OfficialBlock:false,
  exercise12Verification:'source-theorem-derived',
  topperNotes:70,
  priWorkedExamples:56,
  generatedDifficultyCells:56,
  handwriting:'Standard Pri QuestionCard Write/Photo path; no parallel recogniser.',
  offline:'All content and generator metadata are bundled local modules; no network fetch is required.',
  releaseRule:'Full-book completeness and current-exam truth are separate. Book-only content must never be promoted into the current CBSE coverage contract merely because Pri can teach it.'
});

export function ncertClass10Chapter(id){ return NCERT_CLASS10_BY_ID[id] || null; }
