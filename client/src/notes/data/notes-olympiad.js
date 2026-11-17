// Pri Learning · Olympiad topic notes (PRMO → RMO → INMO). Original writing; complete chapters
// in the chapter shape of notes/notesIndex.js plus the Experience 3 fields of notes/e3.js.
//
// Olympiad mathematics is a different subject from school mathematics, not a harder copy of it:
// the chapters teach ideas (invariants, extremal choices, equality cases, substitutions, angle
// chasing, Vieta, descent) through original problems at PRMO and RMO level. In a proof, the
// steps carry the argument and `verify` lets the engine re-derive every number the proof states.
export default {
  'olymp-number-theory': {
    summary: 'Number theory studies the whole numbers through divisibility. Two tools carry most olympiad problems: the Euclidean algorithm, which finds a greatest common divisor and writes it as a combination of the two numbers, and arithmetic modulo $n$, which keeps only remainders. With them you can find the last digits of enormous powers, prove that an equation has no integer solutions, and list every solution of one that does.',
    prereqs: ['c10-real-numbers', 'c9-number-systems', 'c8-exponents'],
    objective: 'Compute gcds and Bézout coefficients with the Euclidean algorithm, reduce large powers with Fermat\u2019s theorem, and use factorisation or remainders to solve or rule out Diophantine equations.',
    intuition: 'Arithmetic modulo $n$ is clock arithmetic: once you only care about the remainder on division by $n$, there are just $n$ numbers left, and sums and products of remainders behave exactly like sums and products of the numbers. Infinite questions become finite ones. The powers of $2$ modulo $7$, for instance, can only cycle through a few remainders, so $2^{40}$ is decided by where $40$ falls in the cycle. An equation with no solution modulo some $n$ has no integer solution at all.',
    concepts: [
      { title: 'Divisibility and the gcd', body: 'If $d$ divides both $a$ and $b$, it divides every combination $ax + by$. In particular $\\gcd(a, b) = \\gcd(b, a - qb)$ for any whole number $q$, which is the step the Euclidean algorithm repeats until the remainder is $0$.' },
      { title: 'Bézout\u2019s identity', body: 'Running the Euclidean algorithm backwards writes $\\gcd(a, b)$ as $ax + by$ with integers $x, y$. So $ax + by = c$ has integer solutions exactly when $\\gcd(a, b)$ divides $c$, and the solutions then step along by $\\left(\\tfrac{b}{g}, -\\tfrac{a}{g}\\right)$ where $g = \\gcd(a, b)$.' },
      { title: 'Congruences', body: 'Write $a \\equiv b \\pmod n$ when $n$ divides $a - b$. Congruences can be added, subtracted, multiplied and raised to powers. Dividing is allowed only by a number coprime to $n$.' },
      { title: 'Fermat and the cycle of powers', body: 'For a prime $p$ not dividing $a$, $a^{p-1} \\equiv 1 \\pmod p$. The powers of $a$ therefore repeat with a period that divides $p - 1$. The smallest such period is the order of $a$ modulo $p$.' },
      { title: 'Ruling out with remainders', body: 'Squares leave only remainders $0$ or $1$ modulo $4$, and $0$ or $1$ modulo $3$. If an equation would force a square to leave another remainder, it has no integer solution. Choosing the right modulus is the skill.' },
      { title: 'Factorising a Diophantine equation', body: 'When one side factorises, as in $x^2 - y^2 = (x - y)(x + y)$, the factors must be a pair of divisors of the other side. A finite list of divisor pairs gives a finite list of cases.' }
    ],
    definitions: [
      { term: 'Divides', meaning: '$a \\mid b$ means $b = ak$ for some integer $k$.' },
      { term: 'Congruent modulo $n$', meaning: '$a \\equiv b \\pmod n$ means $n \\mid a - b$: the two numbers leave the same remainder on division by $n$.' },
      { term: 'Order of $a$ modulo $n$', meaning: 'For $\\gcd(a, n) = 1$, the smallest positive $k$ with $a^k \\equiv 1 \\pmod n$.' },
      { term: 'Diophantine equation', meaning: 'An equation whose solutions are required to be integers.' }
    ],
    formulas: [
      { label: 'Euclidean step', tex: '\\gcd(a, b) = \\gcd(b,\\ a - qb)' },
      { label: 'Bézout', tex: '\\gcd(a, b) = ax + by\\quad\\text{for some integers } x, y' },
      { label: 'Fermat\u2019s little theorem', tex: 'p \\text{ prime},\\ p \\nmid a \\ \\Rightarrow\\ a^{p-1} \\equiv 1 \\pmod p' },
      { label: 'Euler\u2019s theorem', tex: '\\gcd(a, n) = 1 \\ \\Rightarrow\\ a^{\\varphi(n)} \\equiv 1 \\pmod n,\\quad \\varphi(n) = n\\prod_{p \\mid n}\\left(1 - \\tfrac{1}{p}\\right)' },
      { label: 'Number of divisors', tex: 'n = p_1^{e_1} p_2^{e_2} \\cdots p_k^{e_k} \\ \\Rightarrow\\ d(n) = (e_1 + 1)(e_2 + 1)\\cdots(e_k + 1)' }
    ],
    points: [
      { front: 'What does $a \\equiv b \\pmod n$ mean?', back: '$n$ divides $a - b$; $a$ and $b$ leave the same remainder on division by $n$.' },
      { front: 'When does $ax + by = c$ have integer solutions?', back: 'Exactly when $\\gcd(a, b)$ divides $c$.' },
      { front: 'Which remainders can a square leave modulo $4$?', back: 'Only $0$ (even squares) and $1$ (odd squares).' },
      { front: 'How do you find $a^N \\bmod p$ for a prime $p \\nmid a$?', back: 'Reduce the exponent modulo $p - 1$ (Fermat), or modulo the order of $a$ if you know it.' },
      { front: 'How many divisors has $2^4 \\cdot 3^2 \\cdot 5$?', back: '$(4+1)(2+1)(1+1) = 30$.' },
      { front: 'When may you divide both sides of a congruence by $k$?', back: 'When $\\gcd(k, n) = 1$. Otherwise divide the modulus by $\\gcd(k, n)$ as well.' }
    ],
    mistakes: [
      { wrong: 'From $6 \\equiv 16 \\pmod{10}$, dividing by $2$ gives $3 \\equiv 8 \\pmod{10}$.', right: '$2$ is not coprime to $10$. Dividing correctly gives $3 \\equiv 8 \\pmod 5$, which is true.' },
      { wrong: 'Fermat gives $6^{8} \\equiv 1 \\pmod 9$.', right: 'Fermat needs a prime modulus not dividing the base. Here $9$ is not prime and $3 \\mid 6$; in fact $6^2 = 36 \\equiv 0 \\pmod 9$.' },
      { wrong: 'If $\\gcd(a, b) = 1$ and $\\gcd(b, c) = 1$, then $\\gcd(a, c) = 1$.', right: 'False: $a = 2$, $b = 3$, $c = 4$ has $\\gcd(a, c) = 2$. Being coprime is not passed along.' },
      { wrong: 'One solution of $3x + 5y = 19$ is the only one.', right: 'From one solution, adding $5$ to $x$ and subtracting $3$ from $y$ gives another, forever in both directions.' }
    ],
    examples: [
      {
        question: 'Find the remainder when $7^{2026}$ is divided by $13$.',
        steps: [
          '$13$ is prime and does not divide $7$, so Fermat gives $7^{12} \\equiv 1 \\pmod{13}$.',
          '$2026 = 12 \\times 168 + 10$, so $7^{2026} = (7^{12})^{168} \\cdot 7^{10} \\equiv 7^{10} \\pmod{13}$.',
          'Square repeatedly: $7^2 = 49 \\equiv 10$, $7^4 \\equiv 100 \\equiv 9$, $7^8 \\equiv 81 \\equiv 3$.',
          '$7^{10} = 7^8 \\cdot 7^2 \\equiv 3 \\times 10 = 30 \\equiv 4 \\pmod{13}$.'
        ],
        answer: 'The remainder is $4$.',
        verify: { kind: 'values', pairs: [['2026-12*168', '10'], ['7^10-13*floor(7^10/13)', '4']] }
      },
      {
        question: 'Find $\\gcd(391, 299)$ and integers $x, y$ with $391x + 299y = \\gcd(391, 299)$.',
        steps: [
          'Euclid: $391 = 1 \\times 299 + 92$, then $299 = 3 \\times 92 + 23$, then $92 = 4 \\times 23$. The last non-zero remainder is $23$.',
          'Work backwards: $23 = 299 - 3 \\times 92$.',
          'Replace $92$ by $391 - 299$: $23 = 299 - 3(391 - 299) = 4 \\times 299 - 3 \\times 391$.',
          'So $x = -3$ and $y = 4$ work.'
        ],
        answer: '$\\gcd = 23 = 4 \\times 299 - 3 \\times 391$, so $x = -3$, $y = 4$.',
        verify: { kind: 'values', pairs: [['391-299', '92'], ['299-3*92', '23'], ['4*299-3*391', '23']] }
      },
      {
        question: 'Find every pair of positive integers $(x, y)$ with $x^2 - y^2 = 45$.',
        steps: [
          'Factorise: $(x - y)(x + y) = 45$, with $0 < x - y < x + y$.',
          'The divisor pairs of $45$ are $1 \\times 45$, $3 \\times 15$ and $5 \\times 9$. Each pair has two odd numbers, so $x$ and $y$ come out as integers.',
          '$x - y = 1, x + y = 45$ gives $(23, 22)$; $x - y = 3, x + y = 15$ gives $(9, 6)$; $x - y = 5, x + y = 9$ gives $(7, 2)$.'
        ],
        answer: '$(23, 22)$, $(9, 6)$ and $(7, 2)$.',
        verify: { kind: 'values', pairs: [['23^2-22^2', '45'], ['9^2-6^2', '45'], ['7^2-2^2', '45']] }
      },
      {
        question: 'Prove that $n^5 - n$ is divisible by $30$ for every integer $n$.',
        steps: [
          '$30 = 2 \\times 3 \\times 5$, and these are coprime, so it is enough to show each divides $n^5 - n$.',
          'By Fermat, $n^5 \\equiv n \\pmod 5$ for every $n$ (it is true for $5 \\mid n$ too, both sides being $0$).',
          '$n^5 - n = n(n^4 - 1) = (n - 1)n(n + 1)(n^2 + 1)$ contains three consecutive integers, so $2$ and $3$ divide it.',
          'Check one case: $7^5 - 7 = 16800 = 30 \\times 560$.'
        ],
        answer: '$2$, $3$ and $5$ each divide $n^5 - n$, so $30$ does.',
        verify: { kind: 'values', pairs: [['(7^5-7)/30', '560'], ['(4^5-4)/30', '34']] }
      },
      {
        question: 'Show that $x^2 + y^2 = 4z + 3$ has no integer solutions.',
        steps: [
          'Every square leaves remainder $0$ or $1$ on division by $4$: $(2k)^2 = 4k^2$ and $(2k+1)^2 = 4(k^2 + k) + 1$.',
          'So $x^2 + y^2$ leaves remainder $0$, $1$ or $2$.',
          'The right side leaves remainder $3$, which is not on that list.'
        ],
        answer: 'No integers satisfy it: the two sides can never leave the same remainder modulo $4$.',
        verify: { kind: 'values', pairs: [['3^2-4*floor(3^2/4)', '1'], ['6^2-4*floor(6^2/4)', '0']] }
      }
    ],
    check: [
      {
        question: 'Find the remainder when $2^{40}$ is divided by $7$.',
        answer: '$2^3 = 8 \\equiv 1 \\pmod 7$ and $40 = 3 \\times 13 + 1$, so $2^{40} \\equiv 2$.',
        verify: { kind: 'value', expr: '2^40-7*floor(2^40/7)', answer: '2' }
      },
      {
        question: 'Find the smallest positive value of $1001x + 770y$ over all integers $x, y$, and one pair that gives it.',
        answer: 'The smallest positive value is $\\gcd(1001, 770) = 77$. Euclid gives $1001 = 770 + 231$ and $770 = 3 \\times 231 + 77$, so $77 = 4 \\times 770 - 3 \\times 1001$: take $x = -3$, $y = 4$.',
        verify: { kind: 'values', pairs: [['4*770-3*1001', '77'], ['1001/77', '13'], ['770/77', '10']] }
      },
      {
        question: 'How many positive divisors does $720$ have, and how many of them are perfect squares?',
        answer: '$720 = 2^4 \\cdot 3^2 \\cdot 5$ has $5 \\times 3 \\times 2 = 30$ divisors. A square divisor uses an even power of each prime: $3$ choices for $2$, $2$ for $3$, $1$ for $5$, so $6$ squares.',
        verify: { kind: 'values', pairs: [['2^4*3^2*5', '720'], ['5*3*2', '30'], ['3*2*1', '6']] }
      }
    ],
    diagrams: [
      {
        title: 'The powers of $2$ modulo $7$ repeat',
        spec: { kind: 'barChart', categories: ['2^1', '2^2', '2^3', '2^4', '2^5', '2^6'], values: [2, 4, 1, 2, 4, 1], yLabel: 'remainder on division by 7' },
        note: 'The remainders run $2, 4, 1$ and then repeat, because $2^3 \\equiv 1 \\pmod 7$. The order of $2$ modulo $7$ is $3$, a divisor of $7 - 1 = 6$ as Fermat promises. So $2^{40}$ falls where $2^1$ does: remainder $2$.'
      },
      {
        title: 'One Euclidean step as squares cut from a rectangle',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 92, label: '92' }],
          cols: [{ size: 92, label: '92' }, { size: 92, label: '92' }, { size: 92, label: '92' }, { size: 23, label: '23' }],
          cells: [['92^2', '92^2', '92^2', '']]
        },
        note: 'A $299 \\times 92$ rectangle holds three $92 \\times 92$ squares with a $23 \\times 92$ strip left over: $299 = 3 \\times 92 + 23$. The strip is cut exactly by four $23 \\times 23$ squares, so $23$ is the largest square that tiles the whole rectangle: $\\gcd(299, 92) = 23$.'
      },
      {
        title: 'The integer solutions of $3x + 5y = 19$',
        spec: {
          kind: 'plane', xmin: -4, xmax: 10, ymin: -3, ymax: 7,
          lines: [{ through: [[3, 2], [8, -1]], label: '3x+5y=19' }],
          points: [{ x: -2, y: 5, label: '(-2,5)', pos: 'ne' }, { x: 3, y: 2, label: '(3,2)', pos: 'ne' }, { x: 8, y: -1, label: '(8,-1)', pos: 'ne' }]
        },
        note: 'The line passes through grid points only every $5$ units across and $3$ units down: $(-2, 5)$, $(3, 2)$, $(8, -1)$. Each step adds $5$ to $x$ and subtracts $3$ from $y$, which changes $3x + 5y$ by $15 - 15 = 0$.'
      }
    ],
    interactiveNone: 'Congruence arguments are about remainders of whole numbers; the cycle of residues is read completely from one static chart, and no slider over a continuous quantity would show the reason a cycle exists.'
  },

  'olymp-combinatorics': {
    summary: 'Combinatorics counts arrangements and proves that certain arrangements must, or cannot, exist. Counting olympiad problems are usually solved by finding a bijection with something easy to count, by counting one quantity in two ways, or by inclusion–exclusion. Existence problems are solved by the pigeonhole principle, by looking at an extreme case, or by finding an invariant that a process cannot change.',
    prereqs: ['c11-permutations-combinations', 'c11-binomial-theorem', 'c11-sets'],
    objective: 'Count with bijections, stars and bars, double counting and inclusion–exclusion, and prove existence or impossibility with the pigeonhole principle, recursions and invariants.',
    intuition: 'A hard count often becomes easy once you see the objects differently. A way of sharing $10$ sweets among $3$ children is the same thing as a row of $10$ stars and $2$ bars, and rows are easy to count. For existence, think about what cannot be avoided: $13$ people and $12$ months force two people into one month, however you try to spread them. For processes, find a quantity that every move leaves unchanged; if the start and the target disagree on it, no sequence of moves connects them.',
    concepts: [
      { title: 'Bijections', body: 'Two sets have the same size if their elements can be paired off exactly. A $5$-digit number with strictly increasing digits is the same thing as a $5$-element subset of $\\{1, \\ldots, 9\\}$: choose the digits and the order is forced.' },
      { title: 'Stars and bars', body: 'Solutions of $x_1 + \\cdots + x_k = n$ in non-negative integers match rows of $n$ stars and $k - 1$ bars, so there are $\\binom{n+k-1}{k-1}$ of them. For positive integers, give each variable $1$ first.' },
      { title: 'Double counting', body: 'Count one collection in two ways and set the answers equal. Choosing a committee from $n$ people and then a chair from the committee gives $\\sum_k k\\binom{n}{k}$; choosing the chair first gives $n \\cdot 2^{n-1}$.' },
      { title: 'Inclusion–exclusion', body: 'To count what lies in none of several sets, subtract each set, add back each pairwise overlap, subtract each triple overlap, and so on. Every element is then counted exactly once if it is in no set and zero times otherwise.' },
      { title: 'Pigeonhole and the extremal principle', body: 'If more than $kn$ objects go into $n$ boxes, some box holds at least $k + 1$. The extremal principle looks at the largest, smallest or first object of some kind; its extremeness often forces the structure you need.' },
      { title: 'Recursions and invariants', body: 'Count small cases, then express the count for $n$ through smaller counts by asking how the arrangement can begin. For a process, look for a quantity (a parity, a sum, a colouring count) that no move can change.' }
    ],
    definitions: [
      { term: 'Bijection', meaning: 'A pairing of two sets in which every element of each set has exactly one partner in the other.' },
      { term: 'Invariant', meaning: 'A quantity that stays the same under every allowed move of a process.' },
      { term: 'Pigeonhole principle', meaning: 'If $n + 1$ objects are placed in $n$ boxes, some box contains at least two of them.' }
    ],
    formulas: [
      { label: 'Pascal\u2019s rule', tex: '\\binom{n}{k} = \\binom{n-1}{k-1} + \\binom{n-1}{k}' },
      { label: 'Stars and bars', tex: '\\#\\{x_1 + \\cdots + x_k = n,\\ x_i \\ge 0\\} = \\binom{n+k-1}{k-1}' },
      { label: 'Inclusion–exclusion for three sets', tex: '|A \\cup B \\cup C| = |A| + |B| + |C| - |A \\cap B| - |B \\cap C| - |C \\cap A| + |A \\cap B \\cap C|' },
      { label: 'Generalised pigeonhole', tex: 'N \\text{ objects in } k \\text{ boxes} \\ \\Rightarrow\\ \\text{some box has at least } \\left\\lceil \\tfrac{N}{k} \\right\\rceil' },
      { label: 'Committee with a chair', tex: '\\sum_{k=0}^{n} k\\binom{n}{k} = n\\,2^{n-1}' }
    ],
    points: [
      { front: 'How many solutions has $a + b + c = 10$ in non-negative integers?', back: '$\\binom{12}{2} = 66$.' },
      { front: 'What is the first thing to look for in a counting problem?', back: 'A bijection with something you can count directly.' },
      { front: 'What does a pigeonhole argument need you to choose?', back: 'The boxes. The proof is in choosing boxes so that two objects in one box give what you want.' },
      { front: 'How do you show a process can never reach a target?', back: 'Find an invariant whose value at the start differs from its value at the target.' },
      { front: 'Why is $\\binom{n}{k} = \\binom{n}{n-k}$?', back: 'Choosing the $k$ to include is the same as choosing the $n - k$ to leave out.' }
    ],
    mistakes: [
      { wrong: 'The number of ways to put $10$ identical sweets into $3$ boxes is $3^{10}$.', right: '$3^{10}$ counts distinguishable sweets. Identical sweets give $\\binom{12}{2} = 66$ by stars and bars.' },
      { wrong: 'In inclusion–exclusion for three sets, stop after subtracting the pairwise overlaps.', right: 'An element in all three sets has then been counted $3 - 3 = 0$ times; add the triple overlap back once.' },
      { wrong: 'A pigeonhole proof shows which box has two objects.', right: 'It shows only that some box does. If you need to name the box, you need a different argument.' }
    ],
    examples: [
      {
        question: 'In how many ways can $a + b + c = 10$ be solved in non-negative integers? In positive integers?',
        steps: [
          'A solution is a row of $10$ stars and $2$ bars; the bars split the stars into $a$, $b$, $c$. There are $\\binom{12}{2} = 66$ ways to place the bars among $12$ positions.',
          'For positive integers, give $1$ to each first; then $a\' + b\' + c\' = 7$ in non-negative integers, which is $\\binom{9}{2} = 36$ ways.'
        ],
        answer: '$66$ non-negative solutions and $36$ positive ones.',
        verify: { kind: 'values', pairs: [['nCr(12,2)', '66'], ['nCr(9,2)', '36']] }
      },
      {
        question: 'How many of the integers $1, 2, \\ldots, 1000$ are divisible by none of $2$, $3$ and $5$?',
        steps: [
          'Multiples: of $2$, $500$; of $3$, $333$; of $5$, $200$.',
          'Overlaps: of $6$, $166$; of $10$, $100$; of $15$, $66$; of $30$, $33$.',
          'Divisible by at least one: $500 + 333 + 200 - 166 - 100 - 66 + 33 = 734$.',
          'None: $1000 - 734 = 266$.'
        ],
        answer: '$266$.',
        verify: { kind: 'value', expr: '1000-(floor(1000/2)+floor(1000/3)+floor(1000/5))+(floor(1000/6)+floor(1000/10)+floor(1000/15))-floor(1000/30)', answer: '266' }
      },
      {
        question: 'Seven different numbers are chosen from $1, 2, \\ldots, 12$. Prove that two of them add up to $13$.',
        steps: [
          'Make six boxes: $\\{1, 12\\}, \\{2, 11\\}, \\{3, 10\\}, \\{4, 9\\}, \\{5, 8\\}, \\{6, 7\\}$. Every number from $1$ to $12$ is in exactly one box, and each box adds to $13$.',
          'Seven numbers in six boxes: some box receives two of the chosen numbers.',
          'Those two are the whole box, so they add to $13$. With six numbers it can fail: take $1, 2, 3, 4, 5, 6$.'
        ],
        answer: 'Some pair adds to $13$, by pigeonhole on the six pairs.',
        verify: { kind: 'values', pairs: [['12/2', '6'], ['1+2+3+4+5+6', '21']] }
      },
      {
        question: 'The numbers $1, 2, \\ldots, 20$ are written on a board. A move erases two numbers $a, b$ and writes $|a - b|$. After $19$ moves one number is left. Can it be $1$?',
        steps: [
          'Look at the parity of the total. A move replaces $a + b$ by $|a - b|$, and $(a + b) - |a - b|$ is $2\\min(a, b)$, an even number.',
          'So every move keeps the parity of the total. The starting total is $\\tfrac{20 \\times 21}{2} = 210$, which is even.',
          'The last number therefore is even, and cannot be $1$.'
        ],
        answer: 'No. The total stays even, so the last number is even.',
        verify: { kind: 'value', expr: 'sum(k,k,1,20)', answer: '210' }
      },
      {
        question: 'Prove that $\\sum_{k=0}^{n} k\\binom{n}{k} = n \\cdot 2^{n-1}$ by double counting, and check it for $n = 6$.',
        steps: [
          'Count the ways to choose a committee from $n$ people and a chair from the committee.',
          'Committee first: a committee of size $k$ can be chosen in $\\binom{n}{k}$ ways and its chair in $k$ ways, giving $\\sum k\\binom{n}{k}$.',
          'Chair first: $n$ choices, then each of the other $n - 1$ people is in or out, giving $n \\cdot 2^{n-1}$.',
          'For $n = 6$: $6 + 30 + 60 + 60 + 30 + 6 = 192 = 6 \\times 32$.'
        ],
        answer: 'Both counts describe the same choices, so they are equal; for $n = 6$ each is $192$.',
        verify: { kind: 'values', pairs: [['1*nCr(6,1)+2*nCr(6,2)+3*nCr(6,3)+4*nCr(6,4)+5*nCr(6,5)+6*nCr(6,6)', '192'], ['6*2^5', '192']] }
      }
    ],
    check: [
      {
        question: 'What is the least number of people that guarantees three of them were born in the same month?',
        answer: 'With $24$ people, two in each month is possible. With $25$, some month has at least $\\left\\lceil \\tfrac{25}{12} \\right\\rceil = 3$. The answer is $25$.',
        verify: { kind: 'value', expr: '2*12+1', answer: '25' }
      },
      {
        question: 'How many $5$-digit numbers have digits that strictly increase from left to right?',
        answer: 'Such a number cannot use $0$, and its digits are fixed once the set of five digits is chosen from $1$ to $9$: $\\binom{9}{5} = 126$.',
        verify: { kind: 'value', expr: 'nCr(9,5)', answer: '126' }
      },
      {
        question: 'In how many ways can a $2 \\times 10$ strip be tiled with $1 \\times 2$ dominoes?',
        answer: 'The left end is one upright domino or two flat ones, so $t_n = t_{n-1} + t_{n-2}$ with $t_1 = 1$, $t_2 = 2$. This gives $1, 2, 3, 5, 8, 13, 21, 34, 55, 89$, so $t_{10} = 89$.',
        verify: { kind: 'values', pairs: [['21+13', '34'], ['34+21', '55'], ['55+34', '89']] }
      }
    ],
    diagrams: [
      {
        title: 'Pascal\u2019s rule in the triangle',
        spec: { kind: 'pascal', rows: 7, highlight: [[5, 1], [5, 2], [6, 2]], show: 'values' },
        note: 'Each entry is the sum of the two above it: $\\binom{6}{2} = \\binom{5}{1} + \\binom{5}{2} = 5 + 10 = 15$. Choosing $2$ of $6$ people either includes the sixth person (choose $1$ more of $5$) or does not (choose $2$ of $5$).'
      },
      {
        title: 'Inclusion–exclusion for $1$ to $30$',
        spec: { kind: 'venn', sets: 3, labels: ['M_2', 'M_3', 'M_5'], counts: { A: 8, B: 4, C: 2, AB: 4, AC: 2, BC: 1, ABC: 1, none: 8 }, universe: 30 },
        note: 'The circles $M_2$, $M_3$, $M_5$ hold the multiples of $2$, $3$ and $5$ up to $30$: $15$, $10$ and $6$ of them. The pairwise overlaps hold $5$, $3$ and $2$, and only $30$ is in all three. Inclusion–exclusion gives $15 + 10 + 6 - 5 - 3 - 2 + 1 = 22$ inside the circles, so $30 - 22 = 8$ lie outside every circle, as the diagram shows.'
      },
      {
        title: 'A row of Pascal\u2019s triangle as bars',
        spec: { kind: 'binomialExplorer', n: 6, p: 0.5, highlight: [2] },
        note: 'With $p = \\tfrac12$ the bar at $k$ has height $\\binom{n}{k} / 2^n$, so the bars are one row of Pascal\u2019s triangle scaled down. For $n = 6$ the highlighted bar is $\\tfrac{15}{64}$. Change $n$: the row is always symmetric, $\\binom{n}{k} = \\binom{n}{n-k}$, and largest in the middle.'
      }
    ]
  },

  'olymp-inequalities': {
    summary: 'Olympiad inequalities are proved, not checked. Almost every one rests on the fact that a square is never negative, packaged into a few standard tools: AM–GM, Cauchy–Schwarz and its Engel form, and rearrangement. The craft lies in choosing how to split the terms so that the equality case of the tool matches the equality case of the problem.',
    prereqs: ['c11-linear-inequalities', 'c9-algebraic-identities', 'c10-quadratic-equations'],
    objective: 'Prove inequalities and find extreme values with AM–GM and Cauchy–Schwarz, choosing the split of terms from the equality case and checking that the equality case can actually occur.',
    intuition: 'Every one of these tools is $(a - b)^2 \\ge 0$ in disguise, and equality holds when the things being compared are equal. That is the key to using them. Before applying AM–GM, guess where the minimum or maximum happens, then split the terms so that they are equal exactly there. If the terms can never be equal under the given conditions, the bound is true but not attained, and the real extreme lies elsewhere.',
    concepts: [
      { title: 'Squares are non-negative', body: '$a^2 + b^2 - 2ab = (a - b)^2 \\ge 0$, with equality only when $a = b$. Writing an expression as a sum of squares (SOS) proves it is non-negative and shows when it is zero.' },
      { title: 'AM–GM', body: 'For non-negative numbers, the arithmetic mean is at least the geometric mean, with equality exactly when all the numbers are equal. A fixed sum bounds the product above; a fixed product bounds the sum below.' },
      { title: 'Splitting for the equality case', body: 'To maximise $xy^2$ with $x + y = 6$, split $y$ as $\\tfrac{y}{2} + \\tfrac{y}{2}$ so that AM–GM on $x, \\tfrac{y}{2}, \\tfrac{y}{2}$ has a fixed sum. The split is chosen so the three parts can be equal.' },
      { title: 'Cauchy–Schwarz and the Engel form', body: '$\\left(\\sum a_i b_i\\right)^2 \\le \\sum a_i^2 \\sum b_i^2$. Its Engel form, $\\sum \\tfrac{x_i^2}{y_i} \\ge \\tfrac{\\left(\\sum x_i\\right)^2}{\\sum y_i}$ for positive $y_i$, handles sums of fractions; equality holds when $\\tfrac{x_i}{y_i}$ is the same for every $i$.' },
      { title: 'Rearrangement', body: 'For two lists sorted the same way, the sum of products is largest when big is paired with big and smallest when big is paired with small.' },
      { title: 'Equality cases that cannot happen', body: 'A bound from AM–GM is the true extreme only if its equality case is allowed. If it is not, the bound is still true but the extreme is larger (for a minimum), and you must look elsewhere, often at the edge of the allowed range.' }
    ],
    definitions: [
      { term: 'Arithmetic mean', meaning: '$\\tfrac{a_1 + \\cdots + a_n}{n}$.' },
      { term: 'Geometric mean', meaning: '$\\sqrt[n]{a_1 a_2 \\cdots a_n}$ for non-negative $a_i$.' },
      { term: 'Equality case', meaning: 'The values of the variables for which an inequality becomes an equation; the extreme value is attained there, if it is allowed.' }
    ],
    formulas: [
      { label: 'AM–GM for two numbers', tex: '\\frac{a + b}{2} \\ge \\sqrt{ab}\\quad (a, b \\ge 0),\\ \\text{equality iff } a = b' },
      { label: 'AM–GM for $n$ numbers', tex: '\\frac{a_1 + \\cdots + a_n}{n} \\ge \\sqrt[n]{a_1 \\cdots a_n}' },
      { label: 'Cauchy–Schwarz', tex: '(a_1b_1 + \\cdots + a_nb_n)^2 \\le (a_1^2 + \\cdots + a_n^2)(b_1^2 + \\cdots + b_n^2)' },
      { label: 'Engel form', tex: '\\frac{x_1^2}{y_1} + \\cdots + \\frac{x_n^2}{y_n} \\ge \\frac{(x_1 + \\cdots + x_n)^2}{y_1 + \\cdots + y_n}\\quad (y_i > 0)' },
      { label: 'Power-mean chain', tex: '\\sqrt{\\frac{a^2 + b^2}{2}} \\ge \\frac{a + b}{2} \\ge \\sqrt{ab} \\ge \\frac{2ab}{a + b}' }
    ],
    points: [
      { front: 'Minimum of $x + \\tfrac{9}{x}$ for $x > 0$?', back: '$6$, at $x = 3$, by AM–GM: $x + \\tfrac9x \\ge 2\\sqrt{9}$.' },
      { front: 'When does AM–GM become an equation?', back: 'Exactly when all the numbers are equal.' },
      { front: 'What should you do before choosing how to split terms?', back: 'Guess the equality case, then split so the parts are equal there.' },
      { front: 'When does the Engel form become an equation?', back: 'When $\\tfrac{x_1}{y_1} = \\tfrac{x_2}{y_2} = \\cdots$.' },
      { front: 'What does a homogeneous inequality allow?', back: 'Scaling all variables by the same factor, so you may assume a normalisation such as $a + b + c = 1$.' }
    ],
    mistakes: [
      { wrong: '$x + \\tfrac{1}{x} \\ge 2$, so the minimum of $\\sqrt{x^2+2} + \\tfrac{1}{\\sqrt{x^2+2}}$ is $2$.', right: 'Equality needs $\\sqrt{x^2+2} = 1$, which never happens. The minimum is at $x = 0$: $\\sqrt2 + \\tfrac{1}{\\sqrt2} = \\tfrac{3}{\\sqrt2}$.' },
      { wrong: 'With $x + y = 6$, AM–GM on $x$ and $y^2$ gives the maximum of $xy^2$.', right: '$x + y^2$ is not fixed, so that bound is useless. Split $y$ into two halves so the sum $x + \\tfrac{y}{2} + \\tfrac{y}{2}$ is fixed.' },
      { wrong: 'AM–GM works for any real numbers.', right: 'It needs non-negative numbers: $a = b = -1$ gives $\\tfrac{a+b}{2} = -1 < 1 = \\sqrt{ab}$.' }
    ],
    examples: [
      {
        question: 'Find the minimum of $x + \\dfrac{9}{x}$ for $x > 0$.',
        steps: [
          'The product $x \\cdot \\tfrac{9}{x} = 9$ is fixed, so AM–GM bounds the sum below: $x + \\tfrac9x \\ge 2\\sqrt{9} = 6$.',
          'Equality needs $x = \\tfrac{9}{x}$, so $x = 3$, which is allowed.'
        ],
        answer: 'The minimum is $6$, at $x = 3$.',
        verify: { kind: 'values', pairs: [['3+9/3', '6'], ['2*sqrt(9)', '6']] }
      },
      {
        question: 'Positive reals $x, y$ satisfy $x + y = 6$. Find the largest value of $xy^2$.',
        steps: [
          'The maximum should come when $x$ and the two halves of $y$ are balanced, so write $6 = x + \\tfrac{y}{2} + \\tfrac{y}{2}$.',
          'AM–GM on three numbers: $2 = \\tfrac{6}{3} \\ge \\sqrt[3]{x \\cdot \\tfrac{y}{2} \\cdot \\tfrac{y}{2}}$, so $\\tfrac{xy^2}{4} \\le 8$ and $xy^2 \\le 32$.',
          'Equality when $x = \\tfrac{y}{2}$, so $x = 2$ and $y = 4$: $2 \\times 16 = 32$.'
        ],
        answer: 'The largest value is $32$, at $x = 2$, $y = 4$.',
        verify: { kind: 'values', pairs: [['2*4^2', '32'], ['4*(6/3)^3', '32']] }
      },
      {
        question: 'Positive reals $a, b, c$ satisfy $a + b + c = 1$. Find the minimum of $\\dfrac{1}{a} + \\dfrac{4}{b} + \\dfrac{9}{c}$.',
        steps: [
          'Write the terms as $\\tfrac{1^2}{a} + \\tfrac{2^2}{b} + \\tfrac{3^2}{c}$ and use the Engel form: the sum is at least $\\tfrac{(1 + 2 + 3)^2}{a + b + c} = 36$.',
          'Equality needs $\\tfrac{1}{a} = \\tfrac{2}{b} = \\tfrac{3}{c}$, so $a : b : c = 1 : 2 : 3$, giving $a = \\tfrac16$, $b = \\tfrac13$, $c = \\tfrac12$.',
          'Check: $6 + 12 + 18 = 36$.'
        ],
        answer: 'The minimum is $36$, at $a = \\tfrac16$, $b = \\tfrac13$, $c = \\tfrac12$.',
        verify: { kind: 'value', expr: '1/(1/6)+4/(1/3)+9/(1/2)', answer: '36' }
      },
      {
        question: 'Prove that $(a + b)(b + c)(c + a) \\ge 8abc$ for positive reals $a, b, c$.',
        steps: [
          'AM–GM on each bracket: $a + b \\ge 2\\sqrt{ab}$, $b + c \\ge 2\\sqrt{bc}$, $c + a \\ge 2\\sqrt{ca}$.',
          'All six sides are positive, so multiply: the product is at least $8\\sqrt{a^2b^2c^2} = 8abc$.',
          'Equality needs $a = b$, $b = c$ and $c = a$ together, so exactly when $a = b = c$. For example $a = 1$, $b = 2$, $c = 3$ gives $60 \\ge 48$.'
        ],
        answer: 'Multiplying three AM–GM inequalities gives the result, with equality exactly when $a = b = c$.',
        verify: { kind: 'values', pairs: [['(1+2)*(2+3)*(3+1)', '60'], ['8*1*2*3', '48']] }
      }
    ],
    check: [
      {
        question: 'Find the minimum of $4x + \\dfrac{1}{x}$ for $x > 0$.',
        answer: 'The product is $4$, so the sum is at least $2\\sqrt4 = 4$, with equality when $4x = \\tfrac1x$, at $x = \\tfrac12$.',
        verify: { kind: 'value', expr: '4*(1/2)+1/(1/2)', answer: '4' }
      },
      {
        question: 'Positive reals $a, b$ satisfy $ab = 16$. Find the minimum of $a + 4b$.',
        answer: '$a + 4b \\ge 2\\sqrt{4ab} = 16$, with equality when $a = 4b$, so $4b^2 = 16$, $b = 2$, $a = 8$.',
        verify: { kind: 'values', pairs: [['8+4*2', '16'], ['8*2', '16']] }
      },
      {
        question: 'Find the minimum of $\\dfrac{x^2 + 3}{\\sqrt{x^2 + 2}}$ over all real $x$.',
        answer: 'With $t = \\sqrt{x^2+2} \\ge \\sqrt2$, the expression is $t + \\tfrac1t$. AM–GM would need $t = 1$, which is not allowed, and $t + \\tfrac1t$ increases for $t \\ge 1$. So the minimum is at $t = \\sqrt2$, $x = 0$: $\\tfrac{3}{\\sqrt2}$.',
        verify: { kind: 'values', pairs: [['(0+3)/sqrt(0+2)', '3/sqrt(2)'], ['sqrt(2)+1/sqrt(2)', '3/sqrt(2)']] }
      }
    ],
    diagrams: [
      {
        title: 'Move $a$ and follow the minimum of $x + \\tfrac{a}{x}$',
        spec: {
          kind: 'paramGraph', expr: 'x+a/x', xmin: -1, xmax: 10, ymin: -2, ymax: 20,
          params: [{ name: 'a', min: 1, max: 16, step: 1, initial: 9 }],
          show: ['turning']
        },
        note: 'With $a = 9$ the lowest point is $(3, 6)$. For every $a$ the minimum sits at $x = \\sqrt{a}$, where the two terms $x$ and $\\tfrac{a}{x}$ are equal, and its value is $2\\sqrt{a}$: try $a = 16$ and the minimum moves to $(4, 8)$.'
      },
      {
        title: 'The line $y = 6$ touches $y = x + \\tfrac{9}{x}$ once',
        spec: {
          kind: 'function', xmin: -1, xmax: 10, ymin: -1, ymax: 14,
          curves: [{ expr: 'x+9/x', label: 'y=x+\\tfrac{9}{x}' }, { expr: '6', label: 'y=6' }],
          points: [{ x: 3, y: 6, label: '(3,6)' }]
        },
        note: 'For $x > 0$ the curve never dips below the line $y = 6$ and meets it only at $x = 3$: the AM–GM bound is attained exactly at its equality case.'
      },
      {
        title: 'The geometric mean as a half-chord',
        spec: {
          kind: 'plane', xmin: -1, xmax: 11, ymin: -1, ymax: 6, axes: false,
          arcs: [{ cx: 5, cy: 0, r: 5, from: 0, to: 180 }],
          segments: [{ from: [0, 0], to: [10, 0] }, { from: [8, 0], to: [8, 4], label: '4' }, { from: [5, 0], to: [5, 5], label: '5', dashed: true }],
          points: [{ x: 0, y: 0, label: 'A', pos: 'sw' }, { x: 10, y: 0, label: 'B', pos: 'se' }, { x: 8, y: 0, label: 'F', pos: 's' }, { x: 5, y: 0, label: 'O', pos: 's' }, { x: 8, y: 4, label: 'H', pos: 'ne' }],
          angles: [{ at: [8, 0], from: [10, 0], to: [8, 4], right: true }]
        },
        note: 'The diameter $AB = 10$ is split at $F$ into $a = 8$ and $b = 2$. The half-chord $FH$ is $\\sqrt{ab} = 4$, the radius is $\\tfrac{a+b}{2} = 5$, and a half-chord can never be longer than a radius. They are equal only when $F$ is the centre, that is when $a = b$.'
      }
    ]
  },

  'olymp-functional-equations': {
    summary: 'A functional equation asks for every function satisfying a condition, such as $f(x)f(y) = f(x + y) + xy$ for all real $x, y$. The answer has two halves: show that any solution must be one of a few candidates, and check that each candidate really works. The main tools are well-chosen substitutions, replacing a variable by an expression to get a second equation, and properties such as injectivity.',
    prereqs: ['c11-relations-functions', 'c12-relations-functions', 'c10-pair-linear-equations'],
    objective: 'Solve functional equations by substituting special values and expressions, solve the resulting systems for $f$, and check every candidate in the original equation.',
    intuition: 'The equation holds for every $x$ and $y$, so you may choose them. Each choice is a new equation about a few values of $f$. Putting $x = y = 0$ pins down $f(0)$; putting $y = -x$ links $f(x)$ and $f(-x)$; replacing $x$ by $1 - x$ turns one equation into two that you solve like simultaneous equations. The candidates you reach are only necessary. A function can survive every substitution you tried and still fail the original equation, so the final check is part of the proof.',
    concepts: [
      { title: 'Name the assertion', body: 'Write $P(x, y)$ for the statement that the equation holds at $x, y$. Then $P(0, 0)$, $P(x, 0)$, $P(x, -x)$ and $P(x, 1)$ are four separate facts, and naming them keeps a solution readable.' },
      { title: 'Special values first', body: 'Values such as $0$, $1$ and $-1$ make terms vanish. Find $f(0)$ and $f(1)$ early; a case split on their possible values often finishes the problem.' },
      { title: 'Swap to get a system', body: 'If the equation involves $f(x)$ and $f(1 - x)$, or $f(x)$ and $f(-x)$, replace $x$ by $1 - x$ (or $-x$). You get a second linear equation in the same two unknowns, and can solve for $f(x)$.' },
      { title: 'Injective and surjective', body: 'If $f(a) = f(b)$ forces $a = b$, then $f$ is injective, and you may cancel $f$ from both sides of an equation. If every value is taken, $f$ is surjective, and you may substitute a $y$ with $f(y) = 0$.' },
      { title: 'Cauchy\u2019s equation', body: '$f(x + y) = f(x) + f(y)$ forces $f(n) = nf(1)$ for integers and then $f(q) = qf(1)$ for rationals. On the reals this is the only solution once $f$ is continuous, monotonic or bounded on an interval; without such a condition there are others.' },
      { title: 'Always verify', body: 'Substitute each candidate back into the original equation for all $x, y$. Candidates that fail are discarded; the rest are the answer.' }
    ],
    definitions: [
      { term: 'Injective', meaning: '$f(a) = f(b)$ implies $a = b$: different inputs give different outputs.' },
      { term: 'Surjective', meaning: 'Every value in the codomain is $f(x)$ for some $x$.' },
      { term: 'Fixed point', meaning: 'A value $a$ with $f(a) = a$.' },
      { term: 'Additive function', meaning: 'A function with $f(x + y) = f(x) + f(y)$ for all $x, y$ in its domain.' }
    ],
    formulas: [
      { label: 'Cauchy\u2019s equation on the rationals', tex: 'f(x + y) = f(x) + f(y)\\ \\ \\forall x, y \\in \\mathbb{Q} \\ \\Rightarrow\\ f(q) = q\\,f(1)' },
      { label: 'Removing a known part', tex: 'f(x + y) = f(x) + f(y) + 2xy \\ \\Rightarrow\\ g(x) = f(x) - x^2 \\text{ is additive}' },
      { label: 'Swapping $x$ and $1 - x$', tex: '\\begin{cases} f(x) + 2f(1 - x) = x^2 \\\\ 2f(x) + f(1 - x) = (1 - x)^2 \\end{cases}' }
    ],
    points: [
      { front: 'What does $P(0, 0)$ usually give?', back: 'An equation for $f(0)$ alone, often with only one or two possible values.' },
      { front: 'Why must every candidate be checked?', back: 'Substitutions give necessary conditions only. A candidate can pass them and still fail the original equation.' },
      { front: 'How do you handle $f(x)$ and $f(1 - x)$ in one equation?', back: 'Replace $x$ by $1 - x$ to get a second equation and solve the pair.' },
      { front: 'What does injectivity let you do?', back: 'Cancel $f$: from $f(a) = f(b)$ conclude $a = b$.' },
      { front: 'Solutions of $f(x + y) = f(x) + f(y)$ on $\\mathbb{Q}$?', back: 'Exactly $f(x) = cx$, with $c = f(1)$.' }
    ],
    mistakes: [
      { wrong: 'Guessing $f(x) = x + 1$, checking it works, and stopping.', right: 'That shows one solution exists. You must also prove there are no others; the equation $f(x)f(y) = f(x+y) + xy$ has a second solution, $f(x) = 1 - x$.' },
      { wrong: 'Assuming $f$ is a polynomial, or linear, without proof.', right: 'Nothing in a functional equation says $f$ has a formula. Derive the form from substitutions; never assume it.' },
      { wrong: 'From $f(x)(f(0) - 1) = 0$ for all $x$, concluding $f(0) = 1$.', right: 'The other case, $f(x) = 0$ for every $x$, must also be followed and either checked or ruled out.' }
    ],
    examples: [
      {
        question: 'Find every function $f: \\mathbb{R} \\to \\mathbb{R}$ with $f(x) + 2f(1 - x) = x^2$ for all real $x$.',
        steps: [
          'Replace $x$ by $1 - x$: $f(1 - x) + 2f(x) = (1 - x)^2$.',
          'Treat $f(x)$ and $f(1 - x)$ as unknowns. Twice the second equation minus the first gives $3f(x) = 2(1 - x)^2 - x^2 = x^2 - 4x + 2$.',
          'So $f(x) = \\tfrac{x^2 - 4x + 2}{3}$ is the only candidate.',
          'Check at $x = 2$: $f(2) = -\\tfrac23$ and $f(-1) = \\tfrac73$, so $f(2) + 2f(-1) = -\\tfrac23 + \\tfrac{14}{3} = 4 = 2^2$. For every $x$: $f(1 - x) = \\tfrac{x^2 + 2x - 1}{3}$, so $f(x) + 2f(1 - x) = \\tfrac{(x^2 - 4x + 2) + (2x^2 + 4x - 2)}{3} = x^2$.'
        ],
        answer: '$f(x) = \\dfrac{x^2 - 4x + 2}{3}$.',
        verify: { kind: 'values', pairs: [['(2^2-4*2+2)/3+2*((-1)^2-4*(-1)+2)/3', '4'], ['(5^2-4*5+2)/3+2*((-4)^2-4*(-4)+2)/3', '25']] }
      },
      {
        question: 'Find every function $f: \\mathbb{R} \\to \\mathbb{R}$ with $f(x)f(y) = f(x + y) + xy$ for all real $x, y$.',
        steps: [
          '$P(0, 0)$: $f(0)^2 = f(0)$, so $f(0) = 0$ or $1$. If $f(0) = 0$, then $P(x, 0)$ gives $f(x) = 0$ for all $x$, and $P(1, 1)$ becomes $0 = 1$. So $f(0) = 1$.',
          '$P(1, -1)$: $f(1)f(-1) = f(0) - 1 = 0$, so $f(1) = 0$ or $f(-1) = 0$.',
          'If $f(1) = 0$, then $P(x, 1)$ gives $0 = f(x + 1) + x$, so $f(t) = 1 - t$. If $f(-1) = 0$, then $P(x, -1)$ gives $0 = f(x - 1) - x$, so $f(t) = t + 1$.',
          'Check: $(1 + x)(1 + y) = (1 + x + y) + xy$ and $(1 - x)(1 - y) = (1 - x - y) + xy$, both true for all $x, y$.'
        ],
        answer: '$f(x) = x + 1$ and $f(x) = 1 - x$.',
        verify: { kind: 'values', pairs: [['(2+1)*(3+1)', '(5+1)+2*3'], ['(1-2)*(1-3)', '(1-5)+2*3']] }
      },
      {
        question: 'A function $f: \\mathbb{Q} \\to \\mathbb{Q}$ satisfies $f(x + y) = f(x) + f(y) + 2xy$ for all rationals $x, y$, and $f(1) = 3$. Find $f(x)$ and $f(5)$.',
        steps: [
          'The term $2xy$ is what $(x + y)^2 - x^2 - y^2$ produces, so set $g(x) = f(x) - x^2$.',
          'Then $g(x + y) = f(x + y) - (x + y)^2 = f(x) + f(y) - x^2 - y^2 = g(x) + g(y)$: $g$ is additive on $\\mathbb{Q}$.',
          'So $g(x) = g(1)x = (3 - 1)x = 2x$, and $f(x) = x^2 + 2x$.',
          'Check: $(x + y)^2 + 2(x + y) = x^2 + 2x + y^2 + 2y + 2xy$. Then $f(5) = 25 + 10 = 35$.'
        ],
        answer: '$f(x) = x^2 + 2x$ and $f(5) = 35$.',
        verify: { kind: 'values', pairs: [['5^2+2*5', '35'], ['(2+3)^2+2*(2+3)', '(2^2+2*2)+(3^2+2*3)+2*2*3']] }
      }
    ],
    check: [
      {
        question: 'Find $f: \\mathbb{R} \\to \\mathbb{R}$ with $f(x) + 3f(-x) = 8x$ for all $x$, and give $f(3)$.',
        answer: 'Replacing $x$ by $-x$ gives $f(-x) + 3f(x) = -8x$. Solving the pair, $f(x) = -4x$, which checks: $-4x + 12x = 8x$. So $f(3) = -12$.',
        verify: { kind: 'values', pairs: [['-4*3', '-12'], ['-4*3+3*(4*3)', '8*3']] }
      },
      {
        question: 'An additive function $f: \\mathbb{Q} \\to \\mathbb{Q}$ has $f(1) = 5$. Find $f\\left(\\tfrac34\\right)$.',
        answer: '$4f\\left(\\tfrac34\\right) = f(3) = 3f(1) = 15$, so $f\\left(\\tfrac34\\right) = \\tfrac{15}{4}$.',
        verify: { kind: 'value', expr: '3*5/4', answer: '15/4' }
      },
      {
        question: 'Find every $f: \\mathbb{R} \\to \\mathbb{R}$ with $f(x - y) = f(x) + f(y) - 2xy$ for all $x, y$, and give $f(4)$.',
        answer: '$P(0, 0)$ gives $f(0) = 2f(0)$, so $f(0) = 0$. $P(x, x)$ gives $0 = 2f(x) - 2x^2$, so $f(x) = x^2$, and indeed $(x - y)^2 = x^2 + y^2 - 2xy$. Then $f(4) = 16$.',
        verify: { kind: 'values', pairs: [['4^2', '16'], ['(5-2)^2', '5^2+2^2-2*5*2']] }
      }
    ],
    diagrams: [
      {
        title: 'The two solutions of $f(x)f(y) = f(x+y) + xy$',
        spec: {
          kind: 'function', xmin: -4, xmax: 4, ymin: -3, ymax: 5,
          curves: [{ expr: 'x+1', label: 'f(x)=x+1' }, { expr: '1-x', label: 'f(x)=1-x' }],
          points: [{ x: 0, y: 1 }, { x: -1, y: 0, label: '(-1,0)' }, { x: 1, y: 0, label: '(1,0)' }]
        },
        note: 'Both lines pass through $(0, 1)$, because $P(0, 0)$ forced $f(0) = 1$. The case split $f(1) = 0$ or $f(-1) = 0$ is visible too: one line crosses the $x$-axis at $1$, the other at $-1$.'
      },
      {
        title: 'Inputs paired by $x \\mapsto 1 - x$',
        spec: {
          kind: 'plane', xmin: -3, xmax: 5, ymin: -2, ymax: 6,
          curves: [{ expr: '(x^2-4*x+2)/3', label: 'f(x)' }],
          segments: [{ from: [0.5, -2], to: [0.5, 6], dashed: true, label: 'x=\\tfrac12' }],
          points: [{ x: 2, y: -2 / 3, label: '(2,-\\tfrac23)', pos: 'se' }, { x: -1, y: 7 / 3, label: '(-1,\\tfrac73)', pos: 'nw' }]
        },
        note: 'The substitution pairs $2$ with $1 - 2 = -1$: the two inputs sit symmetrically about $x = \\tfrac12$. The equation ties their heights together, $f(2) + 2f(-1) = -\\tfrac23 + \\tfrac{14}{3} = 4$, and that pairing is what made the system solvable.'
      }
    ],
    interactiveNone: 'A functional equation is decided by substitutions on paper; sliding a parameter on a graph shows a candidate but never why it is the only one, so a moving picture here would mislead.'
  },

  'olymp-geometry': {
    summary: 'Olympiad geometry is proved by chasing angles and lengths through a figure until the claim falls out. The most used facts are the circle theorems (equal angles in the same segment, opposite angles of a cyclic quadrilateral, the tangent–chord angle), the power of a point, similar triangles and the theorems of Ceva and Menelaus for lines through a triangle.',
    prereqs: ['c9-circles', 'c10-triangles', 'c10-circles', 'c10-coordinate-geometry'],
    objective: 'Find unknown angles and lengths with the circle theorems and the power of a point, prove four points concyclic, and use Ceva\u2019s theorem for concurrent cevians.',
    intuition: 'A circle turns equal angles into a tool: every point on the same arc sees a chord at the same angle, so spotting four concyclic points instantly produces pairs of equal angles. The power of a point is the same idea for lengths. Any line through a point $P$ meets a circle at two points whose distances from $P$ multiply to the same number, $|OP^2 - r^2|$. Most solutions are a hunt for a hidden circle or a hidden pair of similar triangles.',
    concepts: [
      { title: 'Angle chasing', body: 'Label one unknown angle, then express every other angle in the figure through it, using angle sums, isosceles triangles and the circle theorems. Write each step with its reason.' },
      { title: 'Cyclic quadrilaterals', body: 'Four points $A, B, C, D$ lie on a circle exactly when $\\angle ACB = \\angle ADB$ (with $C, D$ on the same side of $AB$), or when a pair of opposite angles adds to $180^\\circ$. Proving concyclicity is often the hidden key step.' },
      { title: 'Tangent–chord angle', body: 'The angle between a tangent and a chord at the point of contact equals the angle the chord subtends in the alternate segment.' },
      { title: 'Power of a point', body: 'For any line through $P$ meeting the circle at $A$ and $B$, the product $PA \\cdot PB$ is the same: $r^2 - OP^2$ inside, $OP^2 - r^2$ outside. For a tangent from outside, $PT^2$ equals the same number.' },
      { title: 'Radical axis', body: 'The points with equal power with respect to two circles form a straight line. For two intersecting circles it is the line through the two intersection points, and from any point of it outside the circles the tangents to both circles are equal.' },
      { title: 'Ceva and Menelaus', body: 'Cevians $AD, BE, CF$ of triangle $ABC$ are concurrent exactly when $\\tfrac{BD}{DC} \\cdot \\tfrac{CE}{EA} \\cdot \\tfrac{AF}{FB} = 1$. Menelaus gives the matching condition, with value $1$ for unsigned lengths, for three points on a straight line.' }
    ],
    definitions: [
      { term: 'Concyclic', meaning: 'Lying on one circle.' },
      { term: 'Power of a point', meaning: 'For a point $P$ and a circle with centre $O$ and radius $r$, the number $OP^2 - r^2$.' },
      { term: 'Cevian', meaning: 'A segment from a vertex of a triangle to a point on the opposite side.' },
      { term: 'Radical axis', meaning: 'The set of points with equal power with respect to two circles.' }
    ],
    formulas: [
      { label: 'Intersecting chords', tex: 'PA \\cdot PB = PC \\cdot PD = r^2 - OP^2' },
      { label: 'Tangent and secant', tex: 'PT^2 = PA \\cdot PB = OP^2 - r^2' },
      { label: 'Ceva\u2019s theorem', tex: '\\frac{BD}{DC} \\cdot \\frac{CE}{EA} \\cdot \\frac{AF}{FB} = 1' },
      { label: 'Tangent–chord angle', tex: '\\angle(TA,\\ AB) = \\angle ACB' }
    ],
    points: [
      { front: 'What are the two standard tests for a cyclic quadrilateral?', back: 'Opposite angles adding to $180^\\circ$, or a side subtending equal angles at the other two vertices.' },
      { front: 'Power of a point $P$ at distance $13$ from the centre of a circle of radius $5$?', back: '$13^2 - 5^2 = 144$, so a tangent from $P$ has length $12$.' },
      { front: 'Where do the points of equal power for two intersecting circles lie?', back: 'On the line through their two common points, the radical axis.' },
      { front: 'What should you do first with a geometry problem?', back: 'Draw a large, accurate figure. It suggests which points are concyclic and which triangles are similar.' },
      { front: 'Ceva\u2019s condition with $BD : DC = 2$ and $CE : EA = 3$?', back: 'Concurrency needs $AF : FB = \\tfrac{1}{6}$.' }
    ],
    mistakes: [
      { wrong: 'For a secant from $P$ meeting the circle at $A$ then $B$, $PT^2 = PA \\cdot AB$.', right: 'Both lengths are measured from $P$: $PT^2 = PA \\cdot PB$, where $PB = PA + AB$.' },
      { wrong: 'Angles subtended by a chord at any two points of the circle are equal.', right: 'Only for points in the same segment. Points on opposite arcs see the chord at supplementary angles.' },
      { wrong: 'Trusting that a figure looks cyclic.', right: 'A figure suggests a claim; an angle or power-of-a-point argument proves it.' }
    ],
    examples: [
      {
        question: 'Chords $AB$ and $CD$ of a circle meet at $P$ inside it, with $PA = 4$, $PB = 6$ and $PC = 3$. Find $PD$ and the length of $CD$.',
        steps: [
          'By the power of $P$: $PA \\cdot PB = PC \\cdot PD$.',
          'So $24 = 3 \\cdot PD$ and $PD = 8$.',
          '$CD = PC + PD = 11$.'
        ],
        answer: '$PD = 8$ and $CD = 11$.',
        verify: { kind: 'values', pairs: [['4*6/3', '8'], ['3+8', '11']] }
      },
      {
        question: 'From a point $P$ outside a circle, the tangent $PT$ has length $12$. A line through $P$ meets the circle at $A$ and $B$ with $PA = 8$. Find $AB$.',
        steps: [
          'Power of $P$: $PT^2 = PA \\cdot PB$, so $144 = 8 \\cdot PB$.',
          '$PB = 18$, and $AB = PB - PA = 10$.'
        ],
        answer: '$AB = 10$.',
        verify: { kind: 'values', pairs: [['12^2/8', '18'], ['18-8', '10']] }
      },
      {
        question: 'In cyclic quadrilateral $ABCD$, $\\angle DBC = 35^\\circ$ and $\\angle BDC = 40^\\circ$. Find $\\angle BAD$ and $\\angle BCD$.',
        steps: [
          '$\\angle DAC$ and $\\angle DBC$ stand on the chord $DC$ in the same segment, so $\\angle DAC = 35^\\circ$.',
          '$\\angle BAC$ and $\\angle BDC$ stand on the chord $BC$ in the same segment, so $\\angle BAC = 40^\\circ$.',
          '$\\angle BAD = \\angle BAC + \\angle CAD = 75^\\circ$, and opposite angles of a cyclic quadrilateral are supplementary, so $\\angle BCD = 105^\\circ$.',
          'Check in triangle $BCD$: $35^\\circ + 40^\\circ + 105^\\circ = 180^\\circ$.'
        ],
        answer: '$\\angle BAD = 75^\\circ$ and $\\angle BCD = 105^\\circ$.',
        verify: { kind: 'values', pairs: [['35+40', '75'], ['180-75', '105'], ['35+40+105', '180']] }
      },
      {
        question: 'Circles $x^2 + y^2 = 25$ and $(x - 6)^2 + y^2 = 13$ meet at $A$ and $B$. Show that from $P(4, 8)$ the tangents to the two circles are equal, and find their length.',
        steps: [
          'Subtract the equations: $x^2 - (x - 6)^2 = 12$ gives $12x - 36 = 12$, so $x = 4$; then $y = \\pm 3$. So $A(4, 3)$, $B(4, -3)$, and the radical axis is the line $x = 4$, which contains $P$.',
          'Power of $P$ for the first circle: $4^2 + 8^2 - 25 = 55$.',
          'Power for the second: $(4 - 6)^2 + 8^2 - 13 = 55$.',
          'The powers are equal, so the tangent lengths are equal: $\\sqrt{55}$.'
        ],
        answer: 'Both tangents have length $\\sqrt{55}$, because $P$ lies on the radical axis $x = 4$.',
        verify: { kind: 'values', pairs: [['4^2+8^2-25', '55'], ['(4-6)^2+8^2-13', '55'], ['4^2+3^2', '25'], ['(4-6)^2+3^2', '13']] }
      },
      {
        question: 'In triangle $ABC$, points $D, E, F$ lie on $BC, CA, AB$ with $BD : DC = 2 : 1$ and $CE : EA = 3 : 1$. Where must $F$ be for $AD$, $BE$ and $CF$ to be concurrent?',
        steps: [
          'Ceva: $\\tfrac{BD}{DC} \\cdot \\tfrac{CE}{EA} \\cdot \\tfrac{AF}{FB} = 1$.',
          'So $2 \\cdot 3 \\cdot \\tfrac{AF}{FB} = 1$, and $\\tfrac{AF}{FB} = \\tfrac16$.'
        ],
        answer: '$F$ divides $AB$ with $AF : FB = 1 : 6$.',
        verify: { kind: 'value', expr: '1/(2*3)', answer: '1/6' }
      }
    ],
    check: [
      {
        question: 'Chords $AB$ and $CD$ meet at $P$ inside a circle, with $PA = 5$, $PB = 8$ and $PC = 4$. Find $PD$.',
        answer: '$PA \\cdot PB = PC \\cdot PD$ gives $40 = 4 \\cdot PD$, so $PD = 10$.',
        verify: { kind: 'value', expr: '5*8/4', answer: '10' }
      },
      {
        question: 'A point is $10$ cm from the centre of a circle of radius $6$ cm. How long is a tangent from it?',
        answer: 'The power is $10^2 - 6^2 = 64$, so the tangent is $8$ cm.',
        verify: { kind: 'value', expr: 'sqrt(10^2-6^2)', answer: '8' }
      },
      {
        question: 'A line through $P$ meets a circle at $A$ and $B$ with $PA = 4$ and $AB = 12$. Another line through $P$ meets it at $C$ and $D$ with $PC = 2$. Find $CD$.',
        answer: '$PB = 16$, so the power of $P$ is $4 \\times 16 = 64$. Then $PD = \\tfrac{64}{2} = 32$ and $CD = 30$.',
        verify: { kind: 'values', pairs: [['4*(4+12)', '64'], ['64/2-2', '30']] }
      }
    ],
    diagrams: [
      {
        title: 'Two chords through $P$: $8 \\times 2 = 4 \\times 4$',
        spec: {
          kind: 'plane', xmin: -6, xmax: 7, ymin: -6, ymax: 6, axes: false,
          circles: [{ cx: 0, cy: 0, r: 5 }],
          segments: [{ from: [-5, 0], to: [5, 0] }, { from: [3, 4], to: [3, -4] }, { from: [0, 0], to: [3, 4], dashed: true, label: '5' }],
          points: [{ x: 0, y: 0, label: 'O', pos: 'n' }, { x: -5, y: 0, label: 'A', pos: 'w' }, { x: 5, y: 0, label: 'B', pos: 'e' }, { x: 3, y: 0, label: 'P', pos: 'sw' }, { x: 3, y: 4, label: 'C', pos: 'ne' }, { x: 3, y: -4, label: 'D', pos: 'se' }]
        },
        note: 'Here $P = (3, 0)$ inside the circle of radius $5$. Along $AB$: $PA \\cdot PB = 8 \\times 2 = 16$. Along $CD$: $PC \\cdot PD = 4 \\times 4 = 16$. Both equal the power $r^2 - OP^2 = 25 - 9 = 16$.'
      },
      {
        title: 'The radical axis of two circles',
        spec: {
          kind: 'plane', xmin: -6, xmax: 10, ymin: -6, ymax: 10,
          circles: [{ cx: 0, cy: 0, r: 5 }, { cx: 6, cy: 0, r: Math.sqrt(13) }],
          lines: [{ through: [[4, 0], [4, 1]], label: 'x=4' }],
          points: [{ x: 4, y: 3, label: 'A', pos: 'ne' }, { x: 4, y: -3, label: 'B', pos: 'se' }, { x: 4, y: 8, label: 'P(4,8)', pos: 'e' }]
        },
        note: 'The circles meet at $A(4, 3)$ and $B(4, -3)$, and the line through them is $x = 4$. From $P(4, 8)$ the power is $55$ for both circles, so the two tangents from $P$ have the same length, $\\sqrt{55}$.'
      },
      {
        title: 'Angles in the same segment',
        spec: { kind: 'circleExplorer', theorem: 'segment', initial: { a: 30, b: 150, r1: 240, r2: 300 } },
        note: 'Chord $AB$ is seen from $R$ and $S$ on the major arc. Move either point along that arc and its angle does not change; both stay at $60^\\circ$. This is the fact used twice in the angle chase of the third worked example.'
      }
    ]
  },

  'olymp-polynomials': {
    summary: 'A polynomial is pinned down by its roots and its leading coefficient, and Vieta\u2019s relations turn the coefficients into the symmetric functions of the roots. With them you can find sums of powers of roots without solving, find rational roots from the coefficients, and use the divisibility $a - b \\mid P(a) - P(b)$ for integer polynomials.',
    prereqs: ['c10-polynomials', 'c10-quadratic-equations', 'c11-complex-numbers'],
    objective: 'Use Vieta\u2019s relations and power-sum recurrences to evaluate symmetric expressions in the roots, find rational roots and remainders, and reason with $a - b \\mid P(a) - P(b)$ for integer polynomials.',
    intuition: 'Multiply out $(x - \\alpha)(x - \\beta)(x - \\gamma)$ and the coefficients appear as the sum of the roots, the sum of their products in pairs, and their product. So the coefficients already know every symmetric combination of the roots, even when the roots themselves are ugly or not real. Any expression that does not change when you swap roots can be rebuilt from those three numbers.',
    concepts: [
      { title: 'Vieta\u2019s relations', body: 'For $x^3 + px^2 + qx + r$ with roots $\\alpha, \\beta, \\gamma$: $\\alpha + \\beta + \\gamma = -p$, $\\alpha\\beta + \\beta\\gamma + \\gamma\\alpha = q$ and $\\alpha\\beta\\gamma = -r$. The signs alternate.' },
      { title: 'Power sums', body: 'If $\\alpha, \\beta$ are roots of $x^2 - sx + p$, then $s_n = \\alpha^n + \\beta^n$ satisfies $s_n = s\\,s_{n-1} - p\\,s_{n-2}$, because each root satisfies $\\alpha^2 = s\\alpha - p$. Start from $s_0 = 2$ and $s_1 = s$.' },
      { title: 'Rational roots', body: 'If $\\tfrac{p}{q}$ in lowest terms is a root of a polynomial with integer coefficients, then $p$ divides the constant term and $q$ divides the leading coefficient. This gives a short list to test.' },
      { title: 'Remainders', body: 'The remainder on division by a polynomial of degree $d$ has degree less than $d$. Its coefficients are found by substituting the roots of the divisor.' },
      { title: 'Integer polynomials', body: 'For a polynomial with integer coefficients, $a - b$ divides $P(a) - P(b)$, because $a - b$ divides $a^k - b^k$ for every $k$. This rules out many values quickly.' },
      { title: 'Roots of unity', body: 'The roots of $x^n = 1$ are equally spaced round the unit circle. For $\\omega \\ne 1$ with $\\omega^3 = 1$, $1 + \\omega + \\omega^2 = 0$, which collapses many sums.' }
    ],
    definitions: [
      { term: 'Monic', meaning: 'A polynomial with leading coefficient $1$.' },
      { term: 'Symmetric expression', meaning: 'An expression in the roots that is unchanged when any two roots are swapped, such as $\\alpha^2 + \\beta^2 + \\gamma^2$.' },
      { term: 'Root of unity', meaning: 'A complex number $z$ with $z^n = 1$ for some positive integer $n$.' }
    ],
    formulas: [
      { label: 'Vieta for a cubic', tex: 'ax^3 + bx^2 + cx + d:\\quad \\textstyle\\sum \\alpha = -\\frac{b}{a},\\ \\sum \\alpha\\beta = \\frac{c}{a},\\ \\alpha\\beta\\gamma = -\\frac{d}{a}' },
      { label: 'Sum of squares of the roots', tex: '\\alpha^2 + \\beta^2 + \\gamma^2 = \\left(\\textstyle\\sum \\alpha\\right)^2 - 2\\textstyle\\sum \\alpha\\beta' },
      { label: 'Power-sum recurrence', tex: 's_n = s\\,s_{n-1} - p\\,s_{n-2}\\quad\\text{for roots of } x^2 - sx + p' },
      { label: 'Integer polynomials', tex: 'P \\in \\mathbb{Z}[x] \\ \\Rightarrow\\ (a - b) \\mid P(a) - P(b)' },
      { label: 'Cube roots of unity', tex: '\\omega^3 = 1,\\ \\omega \\ne 1 \\ \\Rightarrow\\ 1 + \\omega + \\omega^2 = 0' }
    ],
    points: [
      { front: 'Sum and product of the roots of $x^2 - 3x + 1$?', back: 'Sum $3$, product $1$.' },
      { front: 'Why can a cubic with $\\sum \\alpha^2 < 0$ not have three real roots?', back: 'A sum of squares of real numbers is never negative.' },
      { front: 'Which rational numbers can be roots of $2x^3 - 3x^2 - 11x + 6$?', back: '$\\pm\\tfrac{p}{q}$ with $p \\mid 6$ and $q \\mid 2$.' },
      { front: 'Remainder of $P(x)$ on division by $x - a$?', back: '$P(a)$.' },
      { front: 'What does $a - b \\mid P(a) - P(b)$ need?', back: 'Integer coefficients and integer $a, b$.' }
    ],
    mistakes: [
      { wrong: 'For $x^3 - 7x^2 + 14x - 8$, the sum of the roots is $-7$.', right: 'The sum is $-\\tfrac{b}{a} = 7$. Signs alternate in Vieta: sum $7$, pair sum $14$, product $8$.' },
      { wrong: '$\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2$.', right: 'Subtract twice the product: $\\alpha^2 + \\beta^2 = (\\alpha + \\beta)^2 - 2\\alpha\\beta$.' },
      { wrong: 'The rational root theorem lists all the roots.', right: 'It lists the only possible rational roots. Irrational and complex roots are not on the list.' }
    ],
    examples: [
      {
        question: 'Without solving, find the sum of the squares of the roots of $x^3 - 7x^2 + 14x - 8 = 0$. Then find the roots.',
        steps: [
          'Vieta: $\\sum \\alpha = 7$, $\\sum \\alpha\\beta = 14$, $\\alpha\\beta\\gamma = 8$.',
          '$\\sum \\alpha^2 = 7^2 - 2 \\times 14 = 21$.',
          'Rational roots divide $8$. $x = 1$ gives $1 - 7 + 14 - 8 = 0$, so $x - 1$ is a factor, and the quotient $x^2 - 6x + 8 = (x - 2)(x - 4)$.',
          'The roots $1, 2, 4$ check: $1 + 4 + 16 = 21$.'
        ],
        answer: 'The squares sum to $21$; the roots are $1$, $2$ and $4$.',
        verify: { kind: 'roots', f: 'x^3-7*x^2+14*x-8', answers: ['1', '2', '4'] }
      },
      {
        question: 'If $\\alpha, \\beta$ are the roots of $x^2 - 3x + 1 = 0$, find $\\alpha^5 + \\beta^5$.',
        steps: [
          'Each root satisfies $t^2 = 3t - 1$, so $s_n = \\alpha^n + \\beta^n$ satisfies $s_n = 3s_{n-1} - s_{n-2}$.',
          '$s_0 = 2$ and $s_1 = 3$.',
          '$s_2 = 9 - 2 = 7$, $s_3 = 21 - 3 = 18$, $s_4 = 54 - 7 = 47$, $s_5 = 141 - 18 = 123$.'
        ],
        answer: '$\\alpha^5 + \\beta^5 = 123$.',
        verify: { kind: 'value', expr: '((3+sqrt(5))/2)^5+((3-sqrt(5))/2)^5', answer: '123' }
      },
      {
        question: 'A polynomial $P$ with integer coefficients has $P(1) = 4$. Can $P(6) = 2026$?',
        steps: [
          'For integer coefficients, $6 - 1$ divides $P(6) - P(1)$.',
          'That would need $5 \\mid 2022$, but $2022 = 5 \\times 404 + 2$.'
        ],
        answer: 'No: $5$ does not divide $2022$.',
        verify: { kind: 'value', expr: '2022-5*floor(2022/5)', answer: '2' }
      },
      {
        question: 'Find the roots of $2x^3 - 3x^2 - 11x + 6 = 0$.',
        steps: [
          'Possible rational roots: $\\pm 1, \\pm 2, \\pm 3, \\pm 6, \\pm\\tfrac12, \\pm\\tfrac32$.',
          '$x = 3$: $54 - 27 - 33 + 6 = 0$. Divide: $2x^3 - 3x^2 - 11x + 6 = (x - 3)(2x^2 + 3x - 2)$.',
          '$2x^2 + 3x - 2 = (2x - 1)(x + 2)$.'
        ],
        answer: '$x = 3$, $x = \\tfrac12$ and $x = -2$.',
        verify: { kind: 'roots', f: '2*x^3-3*x^2-11*x+6', answers: ['3', '1/2', '-2'] }
      },
      {
        question: 'Find the remainder when $x^{2026} + x + 1$ is divided by $x^2 - 1$.',
        steps: [
          'The remainder has the form $ax + b$, and $x^{2026} + x + 1 = (x^2 - 1)Q(x) + ax + b$.',
          'At $x = 1$: $3 = a + b$. At $x = -1$: $1 - 1 + 1 = 1 = -a + b$.',
          'So $b = 2$ and $a = 1$.'
        ],
        answer: 'The remainder is $x + 2$.',
        verify: { kind: 'values', pairs: [['1^2026+1+1', '1+2'], ['(-1)^2026-1+1', '-1+2']] }
      }
    ],
    check: [
      {
        question: 'If $\\alpha, \\beta$ are the roots of $x^2 - 5x + 3$, find $\\alpha^2 + \\beta^2$.',
        answer: '$(\\alpha + \\beta)^2 - 2\\alpha\\beta = 25 - 6 = 19$.',
        verify: { kind: 'value', expr: '((5+sqrt(13))/2)^2+((5-sqrt(13))/2)^2', answer: '19' }
      },
      {
        question: 'Find the roots of $x^3 + 2x^2 - 5x - 6 = 0$.',
        answer: '$x = -1$ is a root ($-1 + 2 + 5 - 6 = 0$), and the quotient $x^2 + x - 6 = (x + 3)(x - 2)$. The roots are $-1$, $-3$ and $2$.',
        verify: { kind: 'roots', f: 'x^3+2*x^2-5*x-6', answers: ['-1', '-3', '2'] }
      },
      {
        question: 'Let $\\alpha, \\beta, \\gamma$ be the roots of $x^3 - 2x^2 + 3x - 4$. Find $\\tfrac1\\alpha + \\tfrac1\\beta + \\tfrac1\\gamma$ and $\\alpha^2 + \\beta^2 + \\gamma^2$. What does the second tell you?',
        answer: '$\\tfrac{\\sum \\alpha\\beta}{\\alpha\\beta\\gamma} = \\tfrac34$ and $\\sum \\alpha^2 = 2^2 - 2 \\times 3 = -2$. A negative sum of squares means the roots are not all real.',
        verify: { kind: 'values', pairs: [['3/4', '0.75'], ['2^2-2*3', '-2']] }
      }
    ],
    diagrams: [
      {
        title: 'The cubic with roots $1$, $2$ and $4$',
        spec: {
          kind: 'function', xmin: -1, xmax: 6, ymin: -10, ymax: 6,
          curves: [{ expr: 'x^3-7*x^2+14*x-8', intercepts: true, label: 'y=P(x)' }]
        },
        note: 'Here $P(x) = x^3 - 7x^2 + 14x - 8$. The curve crosses the $x$-axis at $1$, $2$ and $4$, whose sum is $7$ and product $8$, and it meets the $y$-axis at $-8$, minus the product of the roots.'
      },
      {
        title: 'Lift the cubic and watch the roots',
        spec: {
          kind: 'paramGraph', expr: 'x^3-7*x^2+14*x-c', xmin: -1, xmax: 6, ymin: -12, ymax: 10,
          params: [{ name: 'c', min: 0, max: 12, step: 1, initial: 8 }],
          show: ['roots', 'turning']
        },
        note: 'Changing $c$ moves the curve up and down, which changes only the product of the roots. At $c = 8$ the roots are $1, 2, 4$. The turning values are about $8.63$ and $5.89$, so for $c = 6, 7, 8$ there are three real roots, always adding to $7$. Outside that range two of the roots are no longer real, though Vieta still holds for the complex ones.'
      },
      {
        title: 'The cube roots of unity',
        spec: { kind: 'argand', roots: 3, points: [{ re: 1, im: 0, label: '1' }, { re: -0.5, im: Math.sqrt(3) / 2, label: '\\omega' }, { re: -0.5, im: -Math.sqrt(3) / 2, label: '\\omega^2' }] },
        note: 'The three roots of $z^3 = 1$ are equally spaced at $120^\\circ$ on the unit circle. Their real parts are $1, -\\tfrac12, -\\tfrac12$ and their imaginary parts cancel, so $1 + \\omega + \\omega^2 = 0$, the sum of the roots of $z^3 - 1$.'
      }
    ]
  },

  'olymp-proof': {
    summary: 'An olympiad solution is a proof, and a few patterns cover most of them. Induction proves a statement for every $n$ by a base case and a step. Strong induction lets the step use every earlier case. Infinite descent and the well-ordering principle turn a supposed solution into a smaller one until no smaller one can exist. Contradiction, the contrapositive and explicit constructions finish the toolkit.',
    prereqs: ['c11-sequences-series', 'c10-real-numbers', 'c11-sets'],
    objective: 'Write proofs by induction, strong induction, infinite descent, contradiction and explicit construction, with a correct base case, a clear step and a stated conclusion.',
    intuition: 'Induction is a row of dominoes: if the first falls and each falling domino knocks over the next, they all fall. The step is the real work, and it is only honest if it uses nothing but the case before it (or, in strong induction, the cases before it). Descent runs the other way: if a smallest counterexample existed, you would build a smaller one, which is impossible, because whole numbers cannot decrease for ever.',
    concepts: [
      { title: 'Induction', body: 'To prove $P(n)$ for all $n \\ge n_0$: prove $P(n_0)$, then prove that $P(k)$ implies $P(k + 1)$ for every $k \\ge n_0$. In the step, write what you assume and what you must reach before you begin.' },
      { title: 'Strong induction', body: 'The step may assume $P(n_0), \\ldots, P(k)$ all hold. Use it when the case $k + 1$ reduces to a case several steps back, as with paying $k + 1$ in coins by removing one coin.' },
      { title: 'Infinite descent', body: 'Suppose a solution in positive integers exists and take one with the smallest value of some positive quantity. Produce a solution with a smaller value. That contradiction shows no solution exists.' },
      { title: 'Contradiction and contrapositive', body: 'To prove $A \\Rightarrow B$, you may prove that not $B$ implies not $A$, or assume $A$ and not $B$ together and reach something false.' },
      { title: 'Construction', body: 'An existence claim is often proved by writing the object down. Then the proof is a check that it has the required property.' }
    ],
    definitions: [
      { term: 'Base case', meaning: 'The first value $n_0$ for which the statement is checked directly.' },
      { term: 'Inductive step', meaning: 'The proof that the statement for $k$ (or for all values up to $k$) implies it for $k + 1$.' },
      { term: 'Well-ordering principle', meaning: 'Every non-empty set of positive integers has a smallest element.' },
      { term: 'Contrapositive', meaning: 'The contrapositive of $A \\Rightarrow B$ is $\\text{not } B \\Rightarrow \\text{not } A$; the two are logically equivalent.' }
    ],
    formulas: [
      { label: 'Induction', tex: 'P(n_0)\\ \\wedge\\ \\big(P(k) \\Rightarrow P(k + 1)\\ \\ \\forall k \\ge n_0\\big) \\ \\Rightarrow\\ P(n)\\ \\ \\forall n \\ge n_0' },
      { label: 'Sum of the first $n$ odd numbers', tex: '1 + 3 + 5 + \\cdots + (2n - 1) = n^2' },
      { label: 'Largest amount not payable with coprime coins $a, b$', tex: 'ab - a - b' }
    ],
    points: [
      { front: 'What two parts does every induction proof need?', back: 'A base case and an inductive step that holds for every $k$ from the base onwards.' },
      { front: 'When is strong induction the natural choice?', back: 'When the case $k + 1$ reduces to a case further back than $k$.' },
      { front: 'What makes a descent argument work?', back: 'A positive whole-number quantity that strictly decreases each time; it cannot decrease for ever.' },
      { front: 'Is $A \\Rightarrow B$ the same as $B \\Rightarrow A$?', back: 'No. It is equivalent to its contrapositive, not to its converse.' },
      { front: 'How do you prove that something exists?', back: 'Often by constructing it explicitly and checking the property.' }
    ],
    mistakes: [
      { wrong: 'Proving the step $P(k) \\Rightarrow P(k + 1)$ and skipping the base case.', right: 'Without a base case nothing starts the chain. The statement $n = n + 1$ has a valid step and no true case.' },
      { wrong: 'In the step, assuming $P(k + 1)$ and working backwards to something true.', right: 'Reaching a true statement from $P(k + 1)$ proves nothing. Start from $P(k)$ and reach $P(k + 1)$.' },
      { wrong: 'A step that is valid only from $k = 3$, with the base case checked at $n = 1$.', right: 'The step must work from the base case onwards. Check enough base cases to cover every $k$ the step misses.' }
    ],
    examples: [
      {
        question: 'Prove that $1 + 3 + 5 + \\cdots + (2n - 1) = n^2$ for every positive integer $n$.',
        steps: [
          'Base case: for $n = 1$ both sides are $1$.',
          'Step: assume $1 + 3 + \\cdots + (2k - 1) = k^2$. Adding the next odd number, $2k + 1$, gives $k^2 + 2k + 1 = (k + 1)^2$, which is the statement for $k + 1$.',
          'By induction it holds for all $n$. For $n = 10$ the sum is $100$.'
        ],
        answer: 'Proved by induction; the step is $k^2 + (2k + 1) = (k + 1)^2$.',
        verify: { kind: 'values', pairs: [['sum(2*k-1,k,1,10)', '100'], ['sum(2*k-1,k,1,7)', '49']] }
      },
      {
        question: 'Prove that every whole number of rupees from $8$ upwards can be paid exactly with ₹$3$ and ₹$5$ coins.',
        steps: [
          'Base cases: $8 = 3 + 5$, $9 = 3 + 3 + 3$, $10 = 5 + 5$.',
          'Strong step: for $n \\ge 11$, assume every amount from $8$ to $n - 1$ is payable. Then $n - 3 \\ge 8$ is payable, and adding one ₹$3$ coin pays $n$.',
          'Three base cases are needed because the step reaches back $3$.',
          '$7$ cannot be paid: neither $7$ nor $7 - 5 = 2$ is a multiple of $3$. So $8$ is the right starting point, and $7 = 3 \\times 5 - 3 - 5$.'
        ],
        answer: 'Every amount from ₹$8$ upwards is payable; ₹$7$ is the largest that is not.',
        verify: { kind: 'values', pairs: [['3+5', '8'], ['3*3', '9'], ['5+5', '10'], ['3*5-3-5', '7']] }
      },
      {
        question: 'Prove that $x^2 + y^2 = 3z^2$ has no solution in positive integers.',
        steps: [
          'Squares leave remainder $0$ or $1$ on division by $3$. If $x^2 + y^2$ is a multiple of $3$, both remainders must be $0$, so $3 \\mid x$ and $3 \\mid y$.',
          'Write $x = 3a$, $y = 3b$: then $9a^2 + 9b^2 = 3z^2$, so $z^2 = 3(a^2 + b^2)$ and $3 \\mid z$. Write $z = 3c$.',
          'Then $a^2 + b^2 = 3c^2$: a new positive solution with $c < z$.',
          'Take a solution with the smallest $z$; this gives a smaller one, a contradiction. So there is no solution.'
        ],
        answer: 'No solution: any solution would give a strictly smaller one, which is impossible.',
        verify: { kind: 'values', pairs: [['1^2-3*floor(1^2/3)', '1'], ['2^2-3*floor(2^2/3)', '1'], ['3^2-3*floor(3^2/3)', '0']] }
      },
      {
        question: 'Show that there are $100$ consecutive positive integers, none of them prime.',
        steps: [
          'Let $N = 2 \\times 3 \\times 4 \\times \\cdots \\times 101$, the product of the integers from $2$ to $101$.',
          'Consider $N + 2, N + 3, \\ldots, N + 101$. For each $k$ from $2$ to $101$, $k$ divides $N$, so $k$ divides $N + k$, and $N + k > k$.',
          'So each of these numbers has a divisor other than $1$ and itself; there are $101 - 2 + 1 = 100$ of them.'
        ],
        answer: 'The $100$ numbers $N + 2, \\ldots, N + 101$ are all composite.',
        verify: { kind: 'value', expr: '101-2+1', answer: '100' }
      },
      {
        question: 'Prove that $2^n > n^2$ for every integer $n \\ge 5$.',
        steps: [
          'Base case: $2^5 = 32 > 25$.',
          'Step: assume $2^k > k^2$ with $k \\ge 5$. Then $2^{k+1} > 2k^2$.',
          'It remains to show $2k^2 \\ge (k + 1)^2$, that is $k^2 \\ge 2k + 1$. For $k \\ge 5$, $k^2 \\ge 5k = 2k + 3k > 2k + 1$.',
          'Note $n = 4$ fails, $16 = 16$, which is why the base is $5$.'
        ],
        answer: 'Proved by induction from $n = 5$.',
        verify: { kind: 'values', pairs: [['2^5', '32'], ['5^2', '25'], ['2^4', '4^2']] }
      }
    ],
    check: [
      {
        question: 'Prove by induction that $1 \\cdot 2 + 2 \\cdot 3 + \\cdots + n(n + 1) = \\tfrac{n(n+1)(n+2)}{3}$, and use it to find the sum for $n = 10$.',
        answer: 'Base: $2 = \\tfrac{1 \\cdot 2 \\cdot 3}{3}$. Step: $\\tfrac{k(k+1)(k+2)}{3} + (k+1)(k+2) = \\tfrac{(k+1)(k+2)(k+3)}{3}$. For $n = 10$: $\\tfrac{10 \\cdot 11 \\cdot 12}{3} = 440$.',
        verify: { kind: 'values', pairs: [['sum(k*(k+1),k,1,10)', '440'], ['10*11*12/3', '440']] }
      },
      {
        question: 'With only ₹$4$ and ₹$7$ coins, what is the largest amount that cannot be paid exactly? Show that every larger amount can.',
        answer: '$4 \\times 7 - 4 - 7 = 17$. Then $18 = 4 + 7 + 7$, $19 = 4 + 4 + 4 + 7$, $20 = 5 \\times 4$, $21 = 3 \\times 7$, and adding ₹$4$ coins reaches everything beyond (strong induction with four base cases).',
        verify: { kind: 'values', pairs: [['4*7-4-7', '17'], ['4+7+7', '18'], ['3*4+7', '19'], ['5*4', '20'], ['3*7', '21']] }
      },
      {
        question: 'Prove that $x^2 + y^2 = 7z^2$ has no solution in positive integers.',
        answer: 'Squares modulo $7$ are $0, 1, 2, 4$, and two of them add to a multiple of $7$ only as $0 + 0$. So $7 \\mid x$ and $7 \\mid y$; then $49 \\mid 7z^2$ forces $7 \\mid z$, and dividing all three by $7$ gives a smaller solution. Descent rules it out.',
        verify: { kind: 'values', pairs: [['3^2-7*floor(3^2/7)', '2'], ['2^2-7*floor(2^2/7)', '4'], ['1+2+4', '7']] }
      }
    ],
    diagrams: [
      {
        title: 'The inductive step for odd numbers, as area',
        spec: {
          kind: 'areaModel',
          rows: [{ size: 4, label: 'k' }, { size: 1, label: '1' }],
          cols: [{ size: 4, label: 'k' }, { size: 1, label: '1' }],
          cells: [['k^2', 'k'], ['k', '1']]
        },
        note: 'A $k \\times k$ square grows to $(k + 1) \\times (k + 1)$ by adding an L-shape of $k + k + 1 = 2k + 1$ unit squares, the next odd number. That is the whole inductive step: $k^2 + (2k + 1) = (k + 1)^2$.'
      },
      {
        title: 'Partial sums of the odd numbers',
        spec: { kind: 'sequenceExplorer', type: 'arithmetic', first: 1, step: 2, n: 10 },
        note: 'The terms are $1, 3, 5, \\ldots, 19$. Change $n$ and read $S_n$: it is always $n^2$, here $S_{10} = 100$. Checking cases builds belief; the induction proof is what makes it certain for every $n$.'
      },
      {
        title: 'Amounts payable with ₹$3$ and ₹$5$ coins',
        spec: {
          kind: 'numberLine', min: 0, max: 15, step: 1,
          points: [
            { value: 1, open: true, label: '1' }, { value: 2, open: true, label: '2' }, { value: 4, open: true, label: '4' }, { value: 7, open: true, label: '7' },
            { value: 3 }, { value: 5 }, { value: 6 }, { value: 8 }, { value: 9 }, { value: 10 }, { value: 11 }, { value: 12 }, { value: 13 }, { value: 14 }, { value: 15 }
          ]
        },
        note: 'Open circles mark the amounts that cannot be paid: $1, 2, 4, 7$. From $8$ on, three filled circles in a row ($8, 9, 10$) mean every later amount is reached by adding ₹$3$, which is the strong induction step.'
      }
    ]
  }
};
