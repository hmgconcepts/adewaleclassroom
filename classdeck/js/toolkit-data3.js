/* ============================================================
   HMG ACADEMY CLASS DECK — Enterprise extra reference cards (181-card library total)
   Free/offline content: nursery to secondary, Nigeria-friendly.
   ============================================================ */
"use strict";

const TK_CARDS_V3 = [
["Nursery","n_patterns","Pre-writing patterns",[
 "Standing line | draw top to bottom","Sleeping line | draw left to right","Slanting line | slide down a hill","Curve | around the orange","Circle | start at 2 o'clock, go around","Zig-zag | up-down-up-down","Practice big movements before small letters","Say the stroke aloud while writing."]],
["Nursery","n_pencil","Pencil grip & posture",[
 "Tripod grip: thumb + pointer pinch, middle supports","Feet flat, back straight, paper tilted slightly","Helper hand holds the paper","Write from left to right","Do not squeeze the pencil too hard","Short practice is better than long tired practice","Praise effort: neat, slow, careful strokes."]],
["Nursery","n_letters2","Letter families",[
 "Tall letters: b d f h k l t","Short letters: a c e i m n o r s u v w x z","Tail letters: g j p q y","Round family: c o a d g q","Line family: l i t f","Bump family: m n r h b p","Teach by family, not only A-Z order."]],
["Primary Maths","pm_bonds20","Number bonds to 20",[
 "0+20, 1+19, 2+18, 3+17, 4+16","5+15, 6+14, 7+13, 8+12, 9+11, 10+10","Use ten-frames, bottle tops or fingers","If 8+2=10, then 8+12=20","Practice missing numbers: 7 + □ = 20","Fast bonds help addition and subtraction."]],
["Primary Maths","pm_times","Times table strategies",[
 "×2 double | ×4 double-double | ×8 double ×3","×5 ends in 0 or 5","×9: fingers or 10× minus 1×","×11: repeat digit for 1–9","Commutative: 6×7 = 7×6","Arrays prove multiplication facts","Connect division: 42÷6=7 because 6×7=42."]],
["Primary English","pe_blends","Common blends",[
 "bl: black, blue, blend","cl: clap, clock, clean","fl: flag, flower, fly","br: brown, bread, broom","cr: crab, crown, cry","st: star, stop, street","Read blend + rime: st + op = stop."]],
["Primary English","pe_sentence","Sentence checklist",[
 "Capital letter at the beginning","Finger spaces between words","One complete idea","Full stop, question mark or exclamation mark","Names begin with capital letters","Read it aloud: does it make sense?","Example: The dog is running."]],
["Primary Science","ps_materials","Materials & properties",[
 "Hard/soft | rough/smooth | shiny/dull","Transparent lets light through","Waterproof does not soak water","Magnetic attracts iron/steel","Flexible bends without breaking","Choose materials by properties: umbrella = waterproof","Test fairly: change only one thing."]],
["JSS Maths","jm_integers","Integers rules",[
 "+ + = + | - - = + | + - compare signs","Adding negative means move left on number line","Subtracting negative becomes addition","Multiplication/division: same signs positive","Different signs negative","Examples: -3 + 8 = 5 ; -4 × 6 = -24"]],
["JSS Maths","jm_equations","Solving linear equations",[
 "Goal: make x alone","Do the same operation to both sides","x + 5 = 12 → subtract 5 → x=7","3x = 18 → divide by 3 → x=6","2x + 4 = 14 → subtract 4, divide 2","Check by substitution."]],
["JSS Science","js_energy","Forms of energy",[
 "Light, heat, sound, electrical, chemical","Kinetic = movement energy","Potential = stored energy","Energy changes form but is conserved","Torch: chemical → electrical → light + heat","Generator: mechanical → electrical."]],
["JSS Social","jss_civic","Civic responsibilities",[
 "Obey laws and school rules","Respect other people's rights","Pay taxes/levies when due","Vote when eligible","Protect public property","Keep environment clean","Report danger and corruption."]],
["SS Maths","sm_circle","Circle theorems snapshot",[
 "Angle at centre = 2 × angle at circumference","Angles in same segment are equal","Angle in a semicircle = 90°","Opposite angles of cyclic quadrilateral sum 180°","Tangent ⟂ radius at point of contact","Alternate segment theorem links tangent and chord."]],
["SS Maths","sm_triggraphs","Trig graphs",[
 "y=sin x starts 0, peaks 1, returns 0, trough -1","y=cos x starts at 1","Period of sin/cos = 360° or 2π","Amplitude = distance from midline to peak","y=a sin(bx): amplitude |a|, period 360/b","Use the graph tool: sin(x), cos(x), tan(x)."]],
["SS Physics","sp_motion","Equations of motion",[
 "v = u + at","s = ut + 1/2 at²","v² = u² + 2as","s = ((u+v)/2)t","u initial velocity, v final velocity","a acceleration, s displacement, t time","Use only when acceleration is constant."]],
["SS Chemistry","sc_moles","Mole calculations",[
 "1 mole = 6.02×10²³ particles","Moles = mass / molar mass","Concentration = moles / volume(dm³)","Gas at STP: 1 mole ≈ 22.4 dm³","Particles = moles × Avogadro constant","Balance equation before mole ratio."]],
["SS Biology","sb_genetics","Genetics basics",[
 "Gene: unit of inheritance","Allele: alternative form of a gene","Dominant allele shows in heterozygote","Recessive shows only when homozygous","Genotype = genetic makeup (Aa)","Phenotype = observable trait","Punnett square predicts offspring ratios."]],
["Study Skills","ss_note","Cornell notes",[
 "Divide page: cues | notes | summary","During lesson: write short notes and examples","After lesson: add questions/cues on left","Cover notes and answer from cues","Bottom: 3-sentence summary","Review after 1 day, 1 week, 1 month."]],
["Study Skills","ss_pastq","Past-question method",[
 "Attempt first without looking at answers","Mark strictly with scheme","Write why each wrong answer is wrong","Group mistakes by topic","Revise weakest topic, then retry","Time yourself with ClassDeck timer","Track scores in a simple table."]],
["Teacher Tools","tt_differentiation","Differentiation quick ideas",[
 "Same objective, different support levels","Give word bank or worked example for support","Challenge: explain another method or create question","Use pairs: coach + learner","Check understanding with mini-whiteboards","Exit ticket: one thing learnt, one question."]]
];

for (const c of TK_CARDS_V3) TK_CARDS.push(c);
TK_CATS.length = 0;
for (const c of [...new Set(TK_CARDS.map((x) => x[0]))]) TK_CATS.push(c);
