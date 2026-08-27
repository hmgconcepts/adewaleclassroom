/* ============================================================
   HMG ACADEMY CLASS DECK v6 — Toolkit reference library
   93 curriculum reference cards, joined by 16
   interactive tools in toolkit.js  →  202 tool modes total (181 reference cards + 21 interactive tools).
   Each card: [category, id, name, lines[]]
   A line containing "|" renders as a two-column row.
   All content renders on canvas → crisp, offline, broadcastable.
   ============================================================ */
"use strict";

const TK_CARDS = [
/* ================= MATHEMATICS ================= */
["Mathematics","m_squares","Squares, cubes & roots (1–15)",[
 "n | n²  ·  n³  ·  √n (2dp)","1 | 1 · 1 · 1.00","2 | 4 · 8 · 1.41","3 | 9 · 27 · 1.73","4 | 16 · 64 · 2.00","5 | 25 · 125 · 2.24","6 | 36 · 216 · 2.45","7 | 49 · 343 · 2.65","8 | 64 · 512 · 2.83","9 | 81 · 729 · 3.00","10 | 100 · 1000 · 3.16","11 | 121 · 1331 · 3.32","12 | 144 · 1728 · 3.46","13 | 169 · 2197 · 3.61","14 | 196 · 2744 · 3.74","15 | 225 · 3375 · 3.87"]],
["Mathematics","m_primes","Prime numbers up to 200",[
 "2, 3, 5, 7, 11, 13, 17, 19, 23, 29,","31, 37, 41, 43, 47, 53, 59, 61, 67, 71,","73, 79, 83, 89, 97, 101, 103, 107, 109, 113,","127, 131, 137, 139, 149, 151, 157, 163, 167, 173,","179, 181, 191, 193, 197, 199","","A prime has exactly TWO factors: 1 and itself.","1 is NOT prime. 2 is the only even prime."]],
["Mathematics","m_divis","Divisibility rules",[
 "÷2 | last digit even (0,2,4,6,8)","÷3 | digit sum divisible by 3","÷4 | last two digits divisible by 4","÷5 | ends in 0 or 5","÷6 | divisible by 2 AND 3","÷8 | last three digits divisible by 8","÷9 | digit sum divisible by 9","÷10 | ends in 0","÷11 | alternating digit sum divisible by 11"]],
["Mathematics","m_fdp","Fractions ↔ decimals ↔ percent",[
 "1/2 | 0.5 = 50%","1/3 | 0.333… ≈ 33.3%","2/3 | 0.667… ≈ 66.7%","1/4 | 0.25 = 25%","3/4 | 0.75 = 75%","1/5 | 0.2 = 20%","1/8 | 0.125 = 12.5%","3/8 | 0.375 = 37.5%","1/10 | 0.1 = 10%","1/100 | 0.01 = 1%"]],
["Mathematics","m_bodmas","Order of operations (BODMAS)",[
 "B | Brackets first ( ) [ ] { }","O | Orders: powers & roots x², √x","D | Division ÷  (left → right)","M | Multiplication ×  (left → right)","A | Addition +","S | Subtraction −","","Example: 3 + 6 × (5+4) ÷ 3 − 7","= 3 + 6 × 9 ÷ 3 − 7 = 3 + 18 − 7 = 14"]],
["Mathematics","m_angles","Types of angles",[
 "Acute | less than 90°","Right | exactly 90°","Obtuse | between 90° and 180°","Straight | exactly 180°","Reflex | between 180° and 360°","Full turn | 360°","","Angles on a straight line sum to 180°","Angles at a point sum to 360°","Vertically opposite angles are equal"]],
["Mathematics","m_tri","Types of triangles",[
 "Equilateral | 3 equal sides, 3 × 60° angles","Isosceles | 2 equal sides, 2 equal base angles","Scalene | no equal sides, no equal angles","Right-angled | one 90° angle (hypotenuse longest)","","Angle sum of every triangle = 180°","Exterior angle = sum of opposite interior angles"]],
["Mathematics","m_quad","Quadrilaterals",[
 "Square | 4 equal sides, 4 right angles","Rectangle | opposite sides equal, 4 right angles","Parallelogram | opposite sides parallel & equal","Rhombus | 4 equal sides, diagonals ⟂","Trapezium | exactly one pair of parallel sides","Kite | 2 pairs of adjacent equal sides","","Angle sum of every quadrilateral = 360°"]],
["Mathematics","m_circle","Circle: parts & formulas",[
 "Radius r | centre to edge","Diameter d | = 2r (edge to edge through centre)","Circumference | C = 2πr = πd","Area | A = πr²","Arc length | (θ/360) × 2πr","Sector area | (θ/360) × πr²","Chord | line joining two points on circle","Tangent | touches circle at exactly one point","π ≈ 3.14159 or 22/7"]],
["Mathematics","m_perim","Perimeter & area formulas",[
 "Square | P = 4l ;  A = l²","Rectangle | P = 2(l+b) ;  A = l×b","Triangle | A = ½ × base × height","Parallelogram | A = base × height","Trapezium | A = ½(a+b) × h","Circle | C = 2πr ;  A = πr²","","Heron's: A = √[s(s−a)(s−b)(s−c)], s = (a+b+c)/2"]],
["Mathematics","m_vol","Volume & surface area",[
 "Cube | V = l³ ;  SA = 6l²","Cuboid | V = lbh ;  SA = 2(lb+lh+bh)","Cylinder | V = πr²h ;  SA = 2πr(r+h)","Cone | V = ⅓πr²h ;  SA = πr(r+l)","Sphere | V = ⁴⁄₃πr³ ;  SA = 4πr²","Prism | V = cross-section area × length","Pyramid | V = ⅓ × base area × height"]],
["Mathematics","m_pythag","Pythagoras & trig ratios",[
 "Pythagoras: a² + b² = c²  (c = hypotenuse)","","sin θ | opposite ÷ hypotenuse  (SOH)","cos θ | adjacent ÷ hypotenuse  (CAH)","tan θ | opposite ÷ adjacent  (TOA)","","sin30=0.5  cos30=√3/2  tan30=1/√3","sin45=√2/2  cos45=√2/2  tan45=1","sin60=√3/2  cos60=0.5  tan60=√3"]],
["Mathematics","m_algid","Algebraic identities",[
 "(a+b)² | a² + 2ab + b²","(a−b)² | a² − 2ab + b²","a² − b² | (a+b)(a−b)","(a+b)³ | a³ + 3a²b + 3ab² + b³","(a−b)³ | a³ − 3a²b + 3ab² − b³","a³ + b³ | (a+b)(a² − ab + b²)","a³ − b³ | (a−b)(a² + ab + b²)"]],
["Mathematics","m_quadf","Quadratic equations",[
 "Standard form: ax² + bx + c = 0","","Formula:  x = [−b ± √(b²−4ac)] ÷ 2a","Discriminant D = b² − 4ac","D > 0 | two real distinct roots","D = 0 | one repeated real root","D < 0 | no real roots","","Sum of roots = −b/a ; Product = c/a","Completing the square: a(x + b/2a)² …"]],
["Mathematics","m_indices","Laws of indices",[
 "aᵐ × aⁿ | a^(m+n)","aᵐ ÷ aⁿ | a^(m−n)","(aᵐ)ⁿ | a^(mn)","a⁰ | 1  (a ≠ 0)","a⁻ⁿ | 1/aⁿ","a^(1/n) | ⁿ√a","a^(m/n) | ⁿ√(aᵐ)","(ab)ⁿ | aⁿbⁿ"]],
["Mathematics","m_logs","Laws of logarithms",[
 "log(MN) | log M + log N","log(M/N) | log M − log N","log Mᵏ | k·log M","log_a a | 1","log 1 | 0","Change of base | log_b x = log x ÷ log b","","If aˣ = N then x = log_a N","log₁₀100 = 2 because 10² = 100"]],
["Mathematics","m_sets","Set notation",[
 "∈ | is an element of","∉ | is not an element of","⊂ | is a subset of","∪ | union (in A or B or both)","∩ | intersection (in both A and B)","A′ | complement (not in A)","∅ or { } | empty set","n(A) | number of elements in A","ξ or U | universal set","n(A∪B) = n(A)+n(B)−n(A∩B)"]],
["Mathematics","m_roman","Roman numerals",[
 "I=1  V=5  X=10  L=50","C=100  D=500  M=1000","","IV=4  IX=9  XL=40  XC=90","CD=400  CM=900","","2026 | MMXXVI","1999 | MCMXCIX","Smaller before larger = subtract"]],
["Mathematics","m_place","Place value",[
 "Millions | 1 000 000","Hundred thousands | 100 000","Ten thousands | 10 000","Thousands | 1 000","Hundreds | 100","Tens | 10","Units (ones) | 1","Tenths | 0.1","Hundredths | 0.01","Thousandths | 0.001"]],
["Mathematics","m_numtypes","Types of numbers",[
 "Natural ℕ | 1, 2, 3, 4, …","Whole | 0, 1, 2, 3, …","Integers ℤ | …−2, −1, 0, 1, 2…","Rational ℚ | can be written as a/b (b≠0)","Irrational | π, √2, e — non-repeating decimals","Real ℝ | all rational + irrational","Even | divisible by 2 ; Odd: not","Perfect | equals sum of its factors (6, 28…)"]],
["Mathematics","m_coord","Coordinate geometry",[
 "Distance | √[(x₂−x₁)² + (y₂−y₁)²]","Midpoint | ((x₁+x₂)/2 , (y₁+y₂)/2)","Gradient m | (y₂−y₁) ÷ (x₂−x₁)","Line equation | y = mx + c","Parallel lines | equal gradients","Perpendicular | m₁ × m₂ = −1","","Quadrants: I (+,+)  II (−,+)  III (−,−)  IV (+,−)"]],
["Mathematics","m_stats","Statistics formulas",[
 "Mean | sum of values ÷ number of values","Median | middle value (data in order)","Mode | most frequent value","Range | highest − lowest","","Grouped mean = Σfx ÷ Σf","Variance = Σ(x−x̄)² ÷ n","Std deviation = √variance"]],
["Mathematics","m_prob","Probability basics",[
 "P(event) = favourable ÷ total outcomes","P is always between 0 and 1","P(certain) = 1 ;  P(impossible) = 0","P(not A) = 1 − P(A)","","Mutually exclusive: P(A or B) = P(A)+P(B)","Independent: P(A and B) = P(A)×P(B)","","Die: P(6) = 1/6 ; Coin: P(head) = 1/2","Pack of cards: 52 cards, 4 suits, 13 each"]],
["Mathematics","m_interest","Simple & compound interest",[
 "Simple interest | I = PRT ÷ 100","Amount | A = P + I","","Compound | A = P(1 + r/100)ⁿ","n = number of periods","","Profit % = profit ÷ cost × 100","Loss % = loss ÷ cost × 100","Discount = % off marked price"]],
["Mathematics","m_ratio","Ratio & proportion",[
 "Ratio a:b — simplify like fractions","Share ₦P in ratio a:b → parts = a+b","First share = a/(a+b) × P","","Direct proportion | y = kx (both rise)","Inverse proportion | y = k/x (one rises, other falls)","","Map scale 1:50 000 → 1 cm = 500 m","Rate = quantity ÷ time"]],
["Mathematics","m_seq","Sequences (AP & GP)",[
 "Arithmetic (AP): add common difference d","nth term | a + (n−1)d","Sum of n terms | n/2 [2a + (n−1)d]","","Geometric (GP): multiply common ratio r","nth term | arⁿ⁻¹","Sum of n terms | a(rⁿ−1)/(r−1)","Sum to ∞ (|r|<1) | a/(1−r)","","Fibonacci: 1,1,2,3,5,8,13… (add previous two)"]],
/* ================= SCIENCE ================= */
["Science","s_units","SI derived units",[
 "Force | newton (N) = kg·m/s²","Energy / work | joule (J) = N·m","Power | watt (W) = J/s","Pressure | pascal (Pa) = N/m²","Frequency | hertz (Hz) = 1/s","Charge | coulomb (C) = A·s","Voltage | volt (V) = W/A","Resistance | ohm (Ω) = V/A"]],
["Science","s_motion","Equations of motion",[
 "v = u + at","s = ut + ½at²","v² = u² + 2as","s = ½(u+v)t","","u = initial velocity ; v = final velocity","a = acceleration ; s = distance ; t = time","g ≈ 9.8 m/s² (free fall)","speed = distance/time ; velocity has direction"]],
["Science","s_newton","Newton's laws & forces",[
 "1st law | object stays at rest / constant velocity unless a force acts (inertia)","2nd law | F = ma","3rd law | every action has an equal and opposite reaction","","Weight W = mg","Friction opposes motion","Momentum p = mv ; impulse = Ft = Δp"]],
["Science","s_energy","Forms of energy",[
 "Kinetic | movement: KE = ½mv²","Potential | position: PE = mgh","Heat (thermal) | particle vibration","Light | electromagnetic radiation","Sound | vibrations through a medium","Chemical | stored in bonds (food, fuel, battery)","Electrical | moving charges","Nuclear | stored in the nucleus","","Energy cannot be created or destroyed —","only changed from one form to another."]],
["Science","s_elec","Electricity formulas",[
 "Ohm's law | V = IR","Power | P = IV = I²R = V²/R","Energy | E = Pt  (kWh for billing)","Series: R = R₁+R₂ ; same current","Parallel: 1/R = 1/R₁+1/R₂ ; same voltage","","Conductors: copper, aluminium, gold","Insulators: rubber, plastic, glass, dry wood","Fuse & earth wire protect circuits"]],
["Science","s_circsym","Circuit symbols (describe & draw)",[
 "Cell | one long line + one short line","Battery | several cells together","Switch | break in line with lever","Bulb/lamp | circle with cross inside","Resistor | rectangle (or zigzag)","Variable resistor | rectangle + arrow","Ammeter | circle with A (in series)","Voltmeter | circle with V (in parallel)","Motor | circle with M ; Bell: half-circle"]],
["Science","s_magnet","Magnetism",[
 "Like poles repel ; unlike poles attract","Magnetic materials: iron, nickel, cobalt, steel","Field lines run North → South outside magnet","Compass needle is a small magnet","","Make a magnet: stroking, electric current","Electromagnet: coil + iron core + current","Uses: motors, generators, MRI, speakers"]],
["Science","s_waves","Waves & sound",[
 "Wave speed | v = fλ","Frequency f | waves per second (Hz)","Wavelength λ | distance of one cycle","Amplitude | height — loudness of sound","","Transverse: light, water (vibration ⟂ travel)","Longitudinal: sound (vibration ∥ travel)","Sound needs a medium; light does not","Speed of sound ≈ 340 m/s in air","Speed of light = 3 × 10⁸ m/s","Echo: reflected sound; d = vt/2"]],
["Science","s_light","Light & optics",[
 "Light travels in straight lines (rays)","Reflection: angle in = angle out","Refraction: bending when changing medium","","Concave mirror | converges (torch, telescope)","Convex mirror | diverges (car mirror, security)","Convex lens | converges (magnifier, camera, eye)","Concave lens | diverges (short-sight glasses)","","Spectrum: ROYGBIV (prism splits white light)","Primary light colours: red, green, blue"]],
["Science","s_matter","States of matter",[
 "Solid | fixed shape & volume; particles vibrate","Liquid | fixed volume, takes container's shape","Gas | no fixed shape or volume; spreads out","","melting | solid → liquid","freezing | liquid → solid","evaporation/boiling | liquid → gas","condensation | gas → liquid","sublimation | solid → gas directly","","Diffusion: particles spread (faster in gas)"]],
["Science","s_separate","Separation techniques",[
 "Filtration | insoluble solid from liquid (sand+water)","Evaporation | dissolved solid from solution (salt)","Distillation | liquid from solution (pure water)","Fractional distillation | liquids with different b.p. (crude oil)","Chromatography | separating dyes/inks","Magnetism | iron from mixtures","Decantation | pouring off liquid from sediment","Sieving | particles of different sizes"]],
["Science","s_acid","Acids, bases & pH",[
 "pH 0–6 | acid (red/orange on universal indicator)","pH 7 | neutral (green) — pure water","pH 8–14 | alkali/base (blue/purple)","","Acids: HCl, H₂SO₄, vinegar, lemon juice","Bases: NaOH, KOH, soap, antacids","Litmus: acid→red, alkali→blue","","Acid + base → salt + water (neutralisation)","Acid + metal → salt + hydrogen","Acid + carbonate → salt + water + CO₂"]],
["Science","s_react","Types of chemical reactions",[
 "Combination | A + B → AB","Decomposition | AB → A + B","Displacement | A + BC → AC + B","Double decomposition | AB + CD → AD + CB","Combustion | fuel + O₂ → CO₂ + H₂O + energy","","Signs of reaction: colour change, gas given off,","temperature change, precipitate forms","Catalysts speed reactions without being used up"]],
["Science","s_formulas","Common chemical formulas",[
 "Water | H₂O","Carbon dioxide | CO₂","Oxygen gas | O₂","Common salt | NaCl","Hydrochloric acid | HCl","Sulphuric acid | H₂SO₄","Ammonia | NH₃","Methane | CH₄","Glucose | C₆H₁₂O₆","Limestone (calcium carbonate) | CaCO₃"]],
["Science","s_valency","Common valencies & ions",[
 "+1 | Na⁺, K⁺, H⁺, NH₄⁺ (ammonium), Ag⁺","+2 | Ca²⁺, Mg²⁺, Zn²⁺, Fe²⁺, Cu²⁺","+3 | Al³⁺, Fe³⁺","−1 | Cl⁻, OH⁻, NO₃⁻","−2 | O²⁻, SO₄²⁻, CO₃²⁻","−3 | PO₄³⁻","","Formula: swap & drop valencies","e.g. Al³⁺ + O²⁻ → Al₂O₃"]],
["Science","s_reactivity","Reactivity series of metals",[
 "MOST reactive ↓","Potassium (K) — Sodium (Na) — Calcium (Ca)","Magnesium (Mg) — Aluminium (Al) — Zinc (Zn)","Iron (Fe) — Lead (Pb) — HYDROGEN (H)","Copper (Cu) — Silver (Ag) — Gold (Au)","LEAST reactive ↑","","A metal displaces any metal below it","Metals above H react with dilute acids","K, Na, Ca react with cold water"]],
["Science","s_body","Human body systems",[
 "Skeletal | support, protection, movement (206 bones)","Muscular | movement (650+ muscles)","Circulatory | heart, blood, vessels — transport","Respiratory | lungs — gas exchange","Digestive | breaks food into nutrients","Nervous | brain, spinal cord, nerves — control","Excretory | kidneys, skin — removes waste","Reproductive | continuation of species","Endocrine | hormones (glands)","Immune | defence against disease"]],
["Science","s_digest","Digestive system journey",[
 "1. Mouth | teeth chew; saliva starts starch digestion","2. Oesophagus | pushes food down (peristalsis)","3. Stomach | acid + enzymes churn food","4. Small intestine | digestion completes; nutrients absorbed (villi)","5. Large intestine | water absorbed","6. Rectum/anus | waste leaves body","","Liver makes bile (digests fats)","Pancreas makes digestive enzymes + insulin"]],
["Science","s_heart","Heart & circulation",[
 "4 chambers: 2 atria (top) + 2 ventricles (bottom)","Right side → pumps blood to LUNGS","Left side → pumps blood to BODY (thicker wall)","","Arteries | carry blood AWAY from heart","Veins | carry blood TO heart (have valves)","Capillaries | tiny; exchange with cells","","Red cells carry O₂ (haemoglobin)","White cells fight infection; platelets clot","Normal pulse ≈ 60–100 beats/min"]],
["Science","s_resp","Respiratory system",[
 "Path: nose → trachea → bronchi → bronchioles → alveoli","Alveoli: tiny air sacs — gas exchange happens here","O₂ in → blood ; CO₂ out → exhaled","","Breathing in: diaphragm contracts, moves DOWN","Breathing out: diaphragm relaxes, moves UP","","Respiration (in cells):","glucose + oxygen → energy + CO₂ + water","Smoking damages alveoli and cilia"]],
["Science","s_skeleton","Major bones of the body",[
 "Skull | cranium protects the brain","Clavicle | collar bone","Sternum & ribs | protect heart and lungs (12 pairs)","Humerus | upper arm","Radius & ulna | forearm","Vertebrae | spine/backbone (33)","Pelvis | hip girdle","Femur | thigh — longest, strongest bone","Tibia & fibula | lower leg","Joints: hinge (knee, elbow), ball & socket (hip)"]],
["Science","s_senses","The five senses",[
 "Sight | eyes — cornea, lens, retina, optic nerve","Hearing | ears — eardrum, cochlea (also balance)","Smell | nose — olfactory cells","Taste | tongue — sweet, sour, salty, bitter, umami","Touch | skin — pressure, heat, cold, pain","","Sense organs send signals to the brain","through nerves for interpretation."]],
["Science","s_photo","Photosynthesis & respiration",[
 "PHOTOSYNTHESIS (in chloroplasts, needs light):","CO₂ + water → glucose + oxygen","6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂","Needs: sunlight, chlorophyll, CO₂, water","","RESPIRATION (in mitochondria, all cells, always):","glucose + oxygen → energy + CO₂ + water","","They are opposite processes!","Plants do BOTH; animals only respire."]],
["Science","s_food","Food chains & webs",[
 "Sun → producer → consumer → decomposer","","Producer | green plant (makes own food)","Primary consumer | herbivore eats plants","Secondary consumer | carnivore eats herbivore","Decomposer | bacteria/fungi recycle nutrients","","Example: grass → grasshopper → lizard → hawk","Arrow means 'is eaten by' (energy flow)","Energy is lost at each level (~90%)"]],
["Science","s_classify","Classification of living things",[
 "5 kingdoms: Animals, Plants, Fungi, Protista, Monera","","Vertebrates (with backbone):","Fish | gills, scales, cold-blooded","Amphibians | frog — water+land, moist skin","Reptiles | scales, lay eggs on land","Birds | feathers, warm-blooded, lay eggs","Mammals | fur/hair, milk, warm-blooded","","Invertebrates: insects (6 legs), arachnids (8),","molluscs, worms, crustaceans"]],
["Science","s_genetics","Genetics basics",[
 "DNA | the instruction molecule (double helix)","Gene | section of DNA coding one feature","Chromosome | coiled DNA (humans: 46, i.e. 23 pairs)","","Dominant allele (A) shows if present","Recessive allele (a) shows only as aa","Aa × Aa → AA, Aa, Aa, aa (3:1 ratio)","","Sex: XX = female, XY = male","Inherited: eye colour, blood group, height"]],
["Science","s_solar","The solar system",[
 "Order from the Sun:","Mercury | smallest, fastest orbit","Venus | hottest (thick CO₂ atmosphere)","Earth | the only known home of life","Mars | the red planet, 2 moons","Jupiter | largest (gas giant)","Saturn | famous rings","Uranus | tilted on its side","Neptune | farthest, windiest","","Mnemonic: My Very Educated Mother Just Served Us Noodles"]],
["Science","s_moon","Phases of the moon",[
 "New moon | dark (moon between Earth & Sun)","Waxing crescent | sliver grows on the right","First quarter | right half lit","Waxing gibbous | more than half, growing","Full moon | fully lit (Earth between)","Waning gibbous | shrinking","Last quarter | left half lit","Waning crescent | sliver on the left","","Full cycle ≈ 29.5 days","Moon orbits Earth in ≈ 27.3 days"]],
["Science","s_water","The water cycle",[
 "1. Evaporation | sun heats water → vapour rises","2. Transpiration | plants release vapour","3. Condensation | vapour cools → clouds form","4. Precipitation | rain, snow, hail falls","5. Collection | rivers, lakes, oceans, groundwater","…then the cycle repeats!","","Water covers ~71% of Earth","Only ~3% is fresh water"]],
["Science","s_rock","The rock cycle",[
 "Igneous | cooled magma/lava (granite, basalt)","Sedimentary | layers pressed together (limestone, sandstone) — may hold fossils","Metamorphic | changed by heat+pressure (marble from limestone, slate from shale)","","Weathering breaks rocks; erosion moves them","Soil = rock particles + humus + air + water"]],
["Science","s_weather","Weather instruments",[
 "Thermometer | temperature (°C)","Barometer | air pressure","Rain gauge | rainfall (mm)","Anemometer | wind speed","Wind vane | wind direction","Hygrometer | humidity","","Weather = day-to-day conditions","Climate = average over many years"]],
["Science","s_machines","Simple machines",[
 "Lever | crowbar, see-saw, scissors","Pulley | flag pole, crane, well","Inclined plane | ramp, staircase","Wedge | knife, axe, nail","Screw | bolt, jar lid, bottle top","Wheel & axle | car wheel, doorknob","","They multiply force or change direction","MA = load ÷ effort","Work = force × distance"]],
["Science","s_labsafety","Laboratory safety rules",[
 "1. Never eat or drink in the laboratory","2. Wear goggles and lab coat when instructed","3. Tie back long hair near flames","4. Never point a heating test tube at anyone","5. Smell gases by wafting, never directly","6. Report ALL accidents and breakages at once","7. Never taste any chemical","8. Wash hands after every practical","9. Know the fire exit and extinguisher","10. Follow instructions before touching anything"]],
["Science","s_firstaid","Basic first aid",[
 "Cuts | press clean cloth, raise limb, plaster","Burns | cool under running water 10+ min — no creams","Nosebleed | lean FORWARD, pinch soft part 10 min","Sprain | R.I.C.E: Rest, Ice, Compress, Elevate","Fainting | lie down, raise legs, fresh air","Choking | 5 back blows between shoulder blades","","Emergency (Nigeria): 112","Never move someone with a suspected spinal injury"]],
/* ================= ENGLISH ================= */
["English","e_alpha","Alphabet & phonics",[
 "26 letters: 5 vowels (a e i o u) + 21 consonants","","Short vowels | cat, bed, sit, hot, cup","Long vowels | cake, these, kite, bone, cube","Magic e makes the vowel say its name: hop→hope","","Digraphs: sh, ch, th, wh, ph, ck","Blends: bl, cr, st, tr, sp, gr","Silent letters: knee, write, lamb, hour"]],
["English","e_speech","Parts of speech",[
 "Noun | name of person/place/thing: Lagos, joy","Pronoun | replaces a noun: he, she, it, they","Verb | action or state: run, is, think","Adjective | describes a noun: tall, blue","Adverb | describes a verb: quickly, very","Preposition | position/relation: on, under, at","Conjunction | joins: and, but, because","Interjection | exclamation: wow! ouch!","","The quick (adj) fox (noun) ran (verb) swiftly (adv)"]],
["English","e_punct","Punctuation marks",[
 ". full stop | end of a sentence","? question mark | direct questions","! exclamation | strong feeling",", comma | pause, lists, clauses",": colon | introduces a list or idea","; semicolon | joins related sentences","' apostrophe | possession (Ada's) & contraction (don't)","\" \" quotation marks | exact spoken words","( ) brackets | extra information","- hyphen | well-known ; — dash: a break in thought"]],
["English","e_tenses","Tenses at a glance",[
 "Simple present | I walk / she walks","Present continuous | I am walking","Present perfect | I have walked","Simple past | I walked","Past continuous | I was walking","Past perfect | I had walked","Simple future | I will walk","Future continuous | I will be walking","Future perfect | I will have walked"]],
["English","e_irregular","Common irregular verbs",[
 "go | went | gone","see | saw | seen","do | did | done","eat | ate | eaten","take | took | taken","write | wrote | written","begin | began | begun","speak | spoke | spoken","drink | drank | drunk","choose | chose | chosen","(base | past | past participle)"]],
["English","e_affix","Prefixes & suffixes",[
 "un- | not: unhappy, unfair","re- | again: rewrite, return","dis- | opposite: disagree","mis- | wrongly: misspell","pre- | before: preview","-ful | full of: careful","-less | without: careless","-ly | manner: quickly","-tion | act of: education","-er/-or | person who: teacher, actor"]],
["English","e_figures","Figures of speech",[
 "Simile | compares with like/as: brave as a lion","Metaphor | direct: he is a lion","Personification | object acts human: the wind whispered","Hyperbole | exaggeration: I've told you a million times","Alliteration | same sounds: she sells sea shells","Onomatopoeia | sound words: buzz, splash","Irony | opposite of what is meant","Oxymoron | contradiction: bitter-sweet","Idiom | break a leg = good luck"]],
["English","e_letter","Letter & essay formats",[
 "FORMAL letter: your address+date → their address →","salutation (Dear Sir,) → heading/title → body →","Yours faithfully, + full name","","INFORMAL letter: your address+date → Dear Tunde, →","body (friendly tone) → Yours sincerely, + first name","","ESSAY: Introduction → 3–4 body paragraphs","(one idea each + examples) → Conclusion","Argumentative: state stand, give points, rebut, conclude"]],
["English","e_comprehension","Comprehension & summary tips",[
 "1. Read the passage TWICE before questions","2. Underline key names, dates, reasons","3. Answer in your own words unless told to quote","4. 'According to the passage' = only what is written","5. Watch question words: why=reason, how=process","","SUMMARY: one idea per sentence,","no examples, no repetition, count sentences!"]],
["English","e_spelling","Spelling rules",[
 "i before e except after c | believe, receive","Drop final e before -ing | make → making","Double final consonant | run → running","y → i before suffix | happy → happiness","q is always followed by u | queen","","Plurals: -s ; -es after s,x,ch,sh (boxes)","f→ves: leaf→leaves ; o: mango→mangoes","Tricky: necessary, separate, definitely,","accommodation, embarrass, rhythm"]],
["English","e_synonyms","Synonyms & antonyms (sample)",[
 "big | large, huge ↔ small, tiny","happy | glad, joyful ↔ sad, unhappy","fast | quick, rapid ↔ slow, sluggish","begin | start, commence ↔ end, finish","brave | bold, courageous ↔ cowardly","ancient | old, antique ↔ modern, new","abundant | plentiful ↔ scarce","praise | commend ↔ criticise","expand | enlarge ↔ contract, shrink"]],
["English","e_sight","100 sight words (first 50)",[
 "the, of, and, a, to, in, is, you, that, it,","he, was, for, on, are, as, with, his, they, I,","at, be, this, have, from, or, one, had, by, word,","but, not, what, all, were, we, when, your, can, said,","there, use, an, each, which, she, do, how, their, if","","Practise: flash 3 seconds per word,","child reads aloud instantly without sounding out."]],
/* ================= SOCIAL STUDIES ================= */
["Social Studies","g_continents","Continents & oceans",[
 "7 continents by size:","Asia | largest, most people","Africa | 54 countries — our continent!","North America | USA, Canada, Mexico…","South America | Brazil, Argentina…","Antarctica | frozen, no permanent people","Europe | many small countries","Australia/Oceania | smallest","","5 oceans: Pacific (largest), Atlantic,","Indian, Southern, Arctic (smallest)"]],
["Social Studies","g_nigeria","Nigeria quick facts",[
 "Capital | Abuja (former: Lagos)","States | 36 + FCT ; 774 LGAs","Independence | 1 October 1960","Republic | 1 October 1963","Currency | Naira (₦) = 100 kobo","Major rivers | Niger & Benue (meet at Lokoja)","Highest point | Chappal Waddi (2,419 m)","Geo-political zones | NC, NE, NW, SE, SS, SW","Major languages | Hausa, Yoruba, Igbo + English","Population | 200+ million (largest in Africa)"]],
["Social Studies","g_natsymbols","National symbols of Nigeria",[
 "Flag | green-white-green (Taiwo Akinkunmi, 1959)","Green = agriculture ; white = peace & unity","Coat of arms | black shield, Y (Niger & Benue),","2 horses (dignity), eagle (strength)","Motto | Unity and Faith, Peace and Progress","Anthem | 'Nigeria, We Hail Thee'","Pledge | 'I pledge to Nigeria my country…'","National flower | Costus spectabilis"]],
["Social Studies","g_wafrica","West African countries (ECOWAS)",[
 "Nigeria | Abuja","Ghana | Accra","Senegal | Dakar","Côte d'Ivoire | Yamoussoukro","Mali | Bamako","Burkina Faso | Ouagadougou","Niger | Niamey","Guinea | Conakry","Benin | Porto-Novo","Togo | Lomé","Sierra Leone | Freetown","Liberia | Monrovia","The Gambia | Banjul","Guinea-Bissau | Bissau ; Cape Verde | Praia"]],
["Social Studies","g_compass","Compass & map reading",[
 "Cardinal points: North, East, South, West","Mnemonic: Never Eat Soggy Worms (clockwise)","Intercardinal: NE, SE, SW, NW","","Map needs: title, key/legend, scale,","compass rose, border/grid","Scale 1:100 000 → 1 cm = 1 km","Contour lines close together = steep slope","Grid reference: read EASTING first, then northing"]],
["Social Studies","g_timezones","World time zones",[
 "Earth spins 360° in 24 h → 15° per hour","East of you = LATER ; West = EARLIER","Nigeria | GMT+1 (WAT) — no daylight saving","London | GMT (UTC+0/+1 summer)","New York | GMT−5","Dubai | GMT+4","Beijing | GMT+8","Sydney | GMT+10/+11","When it is 12:00 in Lagos → 11:00 London,","06:00 New York, 19:00 Beijing"]],
["Social Studies","g_civic","Civic values & citizenship",[
 "Honesty | truthfulness in words and deeds","Integrity | doing right even when unseen","Respect | for elders, others' rights, property","Responsibility | duties at home, school, nation","Patriotism | love and service to one's country","","Rights: life, education, fair hearing, expression","Duties: pay tax, obey laws, vote, defend nation","Democracy: government of the people, by the","people, for the people"]],
["Social Studies","g_currency","Major world currencies",[
 "Nigeria | Naira ₦","USA | US Dollar $","UK | Pound Sterling £","Eurozone | Euro €","Japan | Yen ¥","China | Yuan/Renminbi ¥","India | Rupee ₹","South Africa | Rand R","Ghana | Cedi ₵","Kenya | Shilling KSh"]],
/* ================= ICT ================= */
["ICT","i_parts","Parts of a computer",[
 "Input | keyboard, mouse, scanner, mic, camera","Output | monitor, printer, speaker, projector","Processing | CPU — the 'brain'","Storage | HDD/SSD, flash drive, memory card","Memory | RAM (temporary, fast)","","Hardware = parts you can touch","Software = programs and apps","Operating systems: Windows, Android, iOS, Linux"]],
["ICT","i_shortcuts","Keyboard shortcuts",[
 "Ctrl + C | copy","Ctrl + X | cut","Ctrl + V | paste","Ctrl + Z | undo  (Ctrl+Y redo)","Ctrl + S | save","Ctrl + A | select all","Ctrl + F | find","Ctrl + P | print","Alt + Tab | switch apps","Windows + D | show desktop"]],
["ICT","i_binary","Binary & number bases",[
 "Computers use base 2: only 0 and 1 (bits)","","Denary → binary: 13 = 8+4+1 = 1101₂","Binary place values: …32, 16, 8, 4, 2, 1","","1₂=1  10₂=2  11₂=3  100₂=4","101₂=5  110₂=6  111₂=7  1000₂=8","","Hex (base 16): 0-9 then A=10 … F=15","FF₁₆ = 255 ; common in colour codes #FF0000"]],
["ICT","i_gates","Logic gates",[
 "NOT | output is the opposite of input","AND | 1 only if BOTH inputs are 1","OR | 1 if AT LEAST one input is 1","NAND | opposite of AND","NOR | opposite of OR","XOR | 1 if inputs are DIFFERENT","","AND: 1·1=1, 1·0=0, 0·0=0","OR: 1+1=1, 1+0=1, 0+0=0"]],
["ICT","i_flowchart","Flowchart symbols",[
 "Oval | start / stop","Parallelogram | input / output","Rectangle | process (do something)","Diamond | decision (yes/no question)","Arrow | direction of flow","Circle | connector","","Algorithm = step-by-step instructions","Always test your flowchart with sample data!"]],
["ICT","i_safety","Internet safety",[
 "1. Never share passwords or OTPs with anyone","2. Keep personal details private (address, school)","3. Don't meet online 'friends' alone","4. Think before you post — it stays forever","5. Tell a trusted adult about anything scary","6. Use strong passwords: long + mixed characters","7. Beware of scams: 'You have won…' = delete!","8. Verify before you share (fake news)","9. Balance screen time with play and sleep"]],
["ICT","i_storage","Storage units",[
 "bit | smallest unit (0 or 1)","byte (B) | 8 bits = one character","kilobyte KB | 1024 B — a paragraph","megabyte MB | 1024 KB — a photo/song","gigabyte GB | 1024 MB — a movie","terabyte TB | 1024 GB — a big hard drive","","Typical: photo 2–5 MB, song 4 MB,","movie 1–2 GB, phone storage 64–256 GB"]],
["ICT","i_programming","Programming concepts",[
 "Variable | named box that stores a value","Input/Output | get data in, show results","Sequence | steps run in order","Selection | IF…THEN…ELSE decisions","Iteration | loops: FOR, WHILE (repeat)","Function | named reusable block of steps","Debug | find and fix errors","","Languages: Scratch (blocks), Python, JavaScript","Pseudocode: plan in plain English first"]],
/* ================= CLASSROOM ================= */
["Classroom","c_rules","Class rules template",[
 "1. Arrive on time and ready to learn","2. Raise your hand to speak ✋","3. Respect everyone — no mocking or insults","4. Listen when others are speaking","5. Keep your camera area tidy (online class)","6. Stay on mute unless permitted 🎙","7. Do your own work — be honest","8. Ask questions — no question is silly!","9. Submit assignments on time","10. Have fun learning! 🎉"]],
["Classroom","c_bloom","Question stems (Bloom's taxonomy)",[
 "Remember | What is…? List… Define…","Understand | Explain… Summarise… Why does…?","Apply | How would you use…? Solve…","Analyse | Compare… What evidence…?","Evaluate | Which is better…? Justify…","Create | Design… What would happen if…?","","Ask up the ladder: start with recall,","end with creation for deep learning."]],
["Classroom","c_grading","Grading scale (WAEC-style)",[
 "A1 | 75–100 — Excellent","B2 | 70–74 — Very good","B3 | 65–69 — Good","C4 | 60–64 — Credit","C5 | 55–59 — Credit","C6 | 50–54 — Credit","D7 | 45–49 — Pass","E8 | 40–44 — Pass","F9 | 0–39 — Fail","University admission usually needs ≥ C6"]],
["Classroom","c_study","Study skills for students",[
 "Pomodoro | 25 min focus + 5 min break × 4","Spaced repetition | review day 1, 3, 7, 21","Active recall | close the book, test yourself","Teach it | explain to someone else (best test!)","Past questions | practise under timed conditions","","Sleep 8 hours before exams — no all-nighters","Phones away during study blocks","Make summary cards per topic"]],
["Classroom","c_phonics_sounds","Phonics sounds chart",[
 "s a t p i n | first sounds taught","m d g o c k | next group","ck e u r h b | ...","f l j v w x | ...","y z qu | single sounds done","","ch sh th ng | consonant digraphs","ai ee igh oa oo | vowel digraphs","ar or ur ow oi | r-controlled & diphthongs","Blend: c-a-t → cat ; segment: dog → d-o-g"]],
];

/* categories present (for the catalog header) */
const TK_CATS = [...new Set(TK_CARDS.map((c) => c[0]))];
