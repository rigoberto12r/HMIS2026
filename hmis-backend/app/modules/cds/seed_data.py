"""
Seed data for drug-drug interactions knowledge base.

~50 clinically significant interactions commonly encountered
in outpatient settings. Idempotent: checks before inserting.

Usage:
    python -m app.modules.cds.seed_data
"""

INTERACTIONS = [
    # ============================================================
    # 1. Anticoagulant interactions (10)
    # ============================================================
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Aspirina",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "Riesgo aumentado de sangrado por efecto anticoagulante aditivo.",
        "clinical_significance": "La combinacion aumenta significativamente el riesgo de hemorragia gastrointestinal y otros sangrados.",
        "management": "Evitar uso concomitante. Si es necesario, monitorear INR frecuentemente y vigilar signos de sangrado.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Ibuprofeno",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "NSAIDs aumentan el riesgo de sangrado GI y potencian el efecto anticoagulante.",
        "clinical_significance": "Incremento de 3-6x en riesgo de sangrado GI comparado con warfarina sola.",
        "management": "Usar alternativa analgesica (acetaminofen). Si es necesario, usar dosis minima por tiempo minimo.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Naproxeno",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "NSAIDs aumentan el riesgo de sangrado y potencian efecto anticoagulante.",
        "clinical_significance": "Riesgo significativamente elevado de hemorragia gastrointestinal.",
        "management": "Evitar combinacion. Considerar acetaminofen como alternativa analgesica.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Diclofenaco",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "NSAIDs aumentan el riesgo de sangrado GI con anticoagulantes.",
        "clinical_significance": "Riesgo elevado de hemorragia gastrointestinal e INR inestable.",
        "management": "Evitar combinacion. Usar analgesico alternativo.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Amiodarona",
        "severity": "critical",
        "interaction_type": "pharmacokinetic",
        "description": "Amiodarona inhibe CYP2C9 y CYP3A4, aumentando marcadamente los niveles de warfarina.",
        "clinical_significance": "INR puede aumentar 2-3x en dias a semanas. Riesgo de hemorragia severa.",
        "management": "Reducir dosis de warfarina 30-50% al iniciar amiodarona. Monitorear INR semanalmente por 6-8 semanas.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Metronidazol",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Metronidazol inhibe el metabolismo de warfarina via CYP2C9.",
        "clinical_significance": "Aumento del INR y riesgo de sangrado en 2-5 dias de uso concomitante.",
        "management": "Monitorear INR a los 3-5 dias de iniciar metronidazol. Considerar reduccion de dosis de warfarina.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Fluconazol",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Fluconazol inhibe CYP2C9 prolongando el efecto de warfarina.",
        "clinical_significance": "INR puede duplicarse. Riesgo significativo de hemorragia.",
        "management": "Reducir dosis de warfarina. Monitorear INR cada 2-3 dias durante tratamiento con fluconazol.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Ciprofloxacina",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Ciprofloxacina puede aumentar el efecto de warfarina por inhibicion de CYP1A2.",
        "clinical_significance": "Aumento variable del INR. Casos reportados de sangrado severo.",
        "management": "Monitorear INR a los 3-5 dias. Considerar antibiotico alternativo.",
        "evidence_level": "probable",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Omeprazol",
        "severity": "moderate",
        "interaction_type": "pharmacokinetic",
        "description": "Omeprazol puede aumentar ligeramente los niveles de warfarina via CYP2C19.",
        "clinical_significance": "Efecto generalmente leve pero clinicamente relevante en algunos pacientes.",
        "management": "Monitorear INR al iniciar o suspender omeprazol. Ajustar dosis si necesario.",
        "evidence_level": "probable",
    },
    {
        "drug_a_name": "Warfarina",
        "drug_b_name": "Rifampicina",
        "severity": "critical",
        "interaction_type": "pharmacokinetic",
        "description": "Rifampicina es potente inductor de CYP2C9 y CYP3A4, reduce drasticamente los niveles de warfarina.",
        "clinical_significance": "El INR puede disminuir a niveles subterapeuticos en 5-7 dias, con riesgo de trombosis.",
        "management": "Evitar combinacion si posible. Si necesario, aumentar dosis de warfarina significativamente y monitorear INR muy frecuentemente.",
        "evidence_level": "established",
    },
    # ============================================================
    # 2. Cardiovascular interactions (8)
    # ============================================================
    {
        "drug_a_name": "Enalapril",
        "drug_b_name": "Cloruro de Potasio",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "IECA + suplementos de potasio aumentan riesgo de hiperpotasemia.",
        "clinical_significance": "Hiperpotasemia puede causar arritmias cardiacas fatales.",
        "management": "Monitorear potasio serico regularmente. Evitar suplementos de K+ a menos que haya hipopotasemia documentada.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Enalapril",
        "drug_b_name": "Espironolactona",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "IECA + diuretico ahorrador de potasio aumentan riesgo de hiperpotasemia severa.",
        "clinical_significance": "Riesgo de hiperpotasemia potencialmente fatal, especialmente en insuficiencia renal.",
        "management": "Monitorear potasio y funcion renal frecuentemente. Usar dosis bajas de espironolactona.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Atenolol",
        "drug_b_name": "Verapamilo",
        "severity": "critical",
        "interaction_type": "pharmacodynamic",
        "description": "Beta-bloqueador + bloqueador de calcio no-dihidropiridinico causa bradicardia severa y bloqueo AV.",
        "clinical_significance": "Riesgo de bradicardia severa, bloqueo AV completo, hipotension y falla cardiaca.",
        "management": "CONTRAINDICADO en uso concomitante IV. Oral: usar solo con extrema precaucion y monitoreo cardiaco.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Digoxina",
        "drug_b_name": "Amiodarona",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Amiodarona aumenta los niveles de digoxina por inhibicion de P-glicoproteina.",
        "clinical_significance": "Niveles de digoxina pueden duplicarse, con riesgo de toxicidad digitalica (nauseas, arritmias).",
        "management": "Reducir dosis de digoxina 50% al iniciar amiodarona. Monitorear niveles de digoxina.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Atorvastatina",
        "drug_b_name": "Gemfibrozil",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Gemfibrozil inhibe glucuronidacion de estatinas, aumentando riesgo de rabdomiolisis.",
        "clinical_significance": "Riesgo significativamente elevado de miopatia y rabdomiolisis.",
        "management": "Evitar combinacion. Si se necesita fibrato, usar fenofibrato que tiene menor interaccion.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Atorvastatina",
        "drug_b_name": "Claritromicina",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Claritromicina inhibe CYP3A4, aumentando niveles de atorvastatina.",
        "clinical_significance": "Riesgo aumentado de miopatia y rabdomiolisis.",
        "management": "Suspender temporalmente la estatina durante tratamiento con claritromicina, o usar azitromicina.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Amlodipino",
        "drug_b_name": "Simvastatina",
        "severity": "moderate",
        "interaction_type": "pharmacokinetic",
        "description": "Amlodipino aumenta los niveles de simvastatina via CYP3A4.",
        "clinical_significance": "Riesgo moderadamente elevado de miopatia con dosis altas de simvastatina.",
        "management": "No exceder simvastatina 20mg/dia con amlodipino. Considerar cambiar a otra estatina.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Losartan",
        "drug_b_name": "Cloruro de Potasio",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "ARA-II + suplementos de potasio pueden causar hiperpotasemia.",
        "clinical_significance": "Riesgo de hiperpotasemia, especialmente en pacientes con funcion renal disminuida.",
        "management": "Monitorear potasio serico. Evitar suplementos de K+ a menos que sean necesarios.",
        "evidence_level": "established",
    },
    # ============================================================
    # 3. Diabetes interactions (6)
    # ============================================================
    {
        "drug_a_name": "Metformina",
        "drug_b_name": "Medio de Contraste Yodado",
        "severity": "critical",
        "interaction_type": "pharmacodynamic",
        "description": "Contraste yodado puede causar nefropatia, acumulando metformina y provocando acidosis lactica.",
        "clinical_significance": "Acidosis lactica potencialmente fatal en pacientes con funcion renal comprometida.",
        "management": "Suspender metformina 48h antes del procedimiento con contraste. Reanudar solo despues de verificar funcion renal normal.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Glibenclamida",
        "drug_b_name": "Fluconazol",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Fluconazol inhibe CYP2C9, aumentando niveles de sulfonilureas.",
        "clinical_significance": "Riesgo de hipoglucemia severa y prolongada.",
        "management": "Monitorear glucemia frecuentemente. Reducir dosis de glibenclamida o usar alternativa.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Insulina",
        "drug_b_name": "Enalapril",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "IECA pueden potenciar el efecto hipoglucemiante de la insulina.",
        "clinical_significance": "Mayor sensibilidad a insulina, riesgo de hipoglucemia.",
        "management": "Monitorear glucemia al iniciar IECA. Ajustar dosis de insulina si necesario.",
        "evidence_level": "probable",
    },
    {
        "drug_a_name": "Metformina",
        "drug_b_name": "Alcohol",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "Alcohol aumenta el riesgo de acidosis lactica con metformina.",
        "clinical_significance": "Riesgo de acidosis lactica, especialmente con consumo excesivo de alcohol.",
        "management": "Evitar consumo excesivo de alcohol. Educar al paciente sobre riesgos.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Glibenclamida",
        "drug_b_name": "Ciprofloxacina",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "Fluoroquinolonas pueden alterar la homeostasis de glucosa.",
        "clinical_significance": "Riesgo de hipoglucemia o hiperglucemia. Efecto impredecible.",
        "management": "Monitorear glucemia frecuentemente durante tratamiento con ciprofloxacina.",
        "evidence_level": "probable",
    },
    {
        "drug_a_name": "Insulina",
        "drug_b_name": "Propranolol",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "Beta-bloqueadores enmascaran sintomas de hipoglucemia (taquicardia, temblor).",
        "clinical_significance": "Hipoglucemia prolongada e inadvertida. Hipertension de rebote posible.",
        "management": "Preferir beta-bloqueadores cardioselectivos (metoprolol). Monitorear glucemia frecuentemente.",
        "evidence_level": "established",
    },
    # ============================================================
    # 4. Antibiotic interactions (8)
    # ============================================================
    {
        "drug_a_name": "Ciprofloxacina",
        "drug_b_name": "Tizanidina",
        "severity": "critical",
        "interaction_type": "pharmacokinetic",
        "description": "Ciprofloxacina inhibe CYP1A2, aumentando niveles de tizanidina 10x.",
        "clinical_significance": "Hipotension severa, somnolencia excesiva, bradicardia.",
        "management": "CONTRAINDICADO. No usar concomitantemente. Usar antibiotico alternativo.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Metronidazol",
        "drug_b_name": "Alcohol",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "Reaccion tipo disulfiram: nauseas, vomitos, rubor, taquicardia.",
        "clinical_significance": "Reaccion adversa severa que puede requerir atencion de emergencia.",
        "management": "EVITAR alcohol durante tratamiento y 48h despues de finalizar metronidazol.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Claritromicina",
        "drug_b_name": "Ergotamina",
        "severity": "critical",
        "interaction_type": "pharmacokinetic",
        "description": "Claritromicina inhibe CYP3A4, aumentando niveles de ergotamina a niveles toxicos.",
        "clinical_significance": "Ergotismo: vasoespasmo severo, isquemia de extremidades, gangrena.",
        "management": "CONTRAINDICADO. Nunca combinar. Usar azitromicina o antibiotico alternativo.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Gentamicina",
        "drug_b_name": "Furosemida",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "Aminoglucosidos + diureticos de asa aumentan riesgo de ototoxicidad y nefrotoxicidad.",
        "clinical_significance": "Perdida auditiva irreversible y dano renal.",
        "management": "Monitorear funcion renal y auditiva. Mantener hidratacion adecuada.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Tetraciclina",
        "drug_b_name": "Hidroxido de Aluminio",
        "severity": "moderate",
        "interaction_type": "pharmacokinetic",
        "description": "Antiacidos reducen la absorcion de tetraciclinas por quelacion.",
        "clinical_significance": "Reduccion de hasta 90% en absorcion, causando falla terapeutica.",
        "management": "Separar administracion por al menos 2 horas. Tetraciclina 1h antes o 2h despues del antiacido.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Ciprofloxacina",
        "drug_b_name": "Hidroxido de Aluminio",
        "severity": "moderate",
        "interaction_type": "pharmacokinetic",
        "description": "Antiacidos reducen absorcion de fluoroquinolonas por quelacion con cationes.",
        "clinical_significance": "Reduccion significativa de niveles sanguineos del antibiotico.",
        "management": "Administrar ciprofloxacina 2h antes o 6h despues del antiacido.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Rifampicina",
        "drug_b_name": "Anticonceptivos Orales",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Rifampicina induce CYP3A4, reduciendo drasticamente niveles de estrogenos/progestagenos.",
        "clinical_significance": "Falla anticonceptiva con riesgo de embarazo no deseado.",
        "management": "Usar metodo anticonceptivo adicional de barrera durante y 28 dias despues de rifampicina.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Trimetoprim",
        "drug_b_name": "Metotrexato",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "Ambos inhiben el metabolismo del folato, con toxicidad hematologica aditiva.",
        "clinical_significance": "Riesgo de pancitopenia, anemia megaloblastica severa.",
        "management": "Evitar combinacion. Si es necesario, administrar acido folinico y monitorear hemograma.",
        "evidence_level": "established",
    },
    # ============================================================
    # 5. NSAID interactions (6)
    # ============================================================
    {
        "drug_a_name": "Ibuprofeno",
        "drug_b_name": "Enalapril",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "NSAIDs reducen efecto antihipertensivo de IECA y aumentan riesgo de deterioro renal.",
        "clinical_significance": "Elevacion de presion arterial e insuficiencia renal aguda en pacientes susceptibles.",
        "management": "Monitorear presion arterial y funcion renal. Preferir acetaminofen como analgesico.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Ibuprofeno",
        "drug_b_name": "Litio",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "NSAIDs reducen excrecion renal de litio, aumentando sus niveles.",
        "clinical_significance": "Toxicidad por litio: temblor, confusion, arritmias, convulsiones.",
        "management": "Evitar NSAIDs. Si es necesario, monitorear niveles de litio cada 4-5 dias.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Ibuprofeno",
        "drug_b_name": "Metotrexato",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "NSAIDs reducen excrecion renal de metotrexato, aumentando toxicidad.",
        "clinical_significance": "Riesgo de mielosupresion, mucositis y toxicidad renal severa.",
        "management": "Evitar NSAIDs con metotrexato en dosis altas. Monitorear funcion renal y hemograma.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Aspirina",
        "drug_b_name": "Ibuprofeno",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "Ibuprofeno antagoniza el efecto antiplaquetario cardioprotector de la aspirina.",
        "clinical_significance": "Reduccion del efecto cardioprotector de aspirina a dosis bajas.",
        "management": "Tomar aspirina 30 min antes o 8h despues de ibuprofeno. Considerar alternativa analgesica.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Diclofenaco",
        "drug_b_name": "Fluoxetina",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "NSAIDs + SSRIs aumentan riesgo de sangrado GI por efecto aditivo sobre plaquetas.",
        "clinical_significance": "Riesgo de sangrado GI 3-15x mayor que con cada medicamento solo.",
        "management": "Considerar gastroproteccion con omeprazol. Monitorear signos de sangrado.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Ibuprofeno",
        "drug_b_name": "Prednisona",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "NSAIDs + corticosteroides aumentan riesgo de ulcera y sangrado GI.",
        "clinical_significance": "Riesgo significativamente aumentado de ulcera gastrica y sangrado.",
        "management": "Agregar gastroproteccion (omeprazol/pantoprazol). Usar dosis minima por tiempo minimo.",
        "evidence_level": "established",
    },
    # ============================================================
    # 6. Psychotropic interactions (6)
    # ============================================================
    {
        "drug_a_name": "Fluoxetina",
        "drug_b_name": "Fenelzina",
        "severity": "critical",
        "interaction_type": "pharmacodynamic",
        "description": "SSRI + IMAO causa sindrome serotoninergico potencialmente fatal.",
        "clinical_significance": "Sindrome serotoninergico: hipertermia, rigidez, clonus, agitacion, coma, muerte.",
        "management": "CONTRAINDICADO ABSOLUTAMENTE. Esperar 5 semanas despues de suspender fluoxetina antes de iniciar IMAO.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Sertralina",
        "drug_b_name": "Tramadol",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "SSRI + tramadol aumenta riesgo de sindrome serotoninergico.",
        "clinical_significance": "Sindrome serotoninergico: confusion, taquicardia, hipertermia, mioclonus.",
        "management": "Evitar combinacion si posible. Si es necesario, usar dosis minimas y monitorear sintomas.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Fluoxetina",
        "drug_b_name": "Carbamazepina",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Fluoxetina inhibe CYP3A4/2C8, aumentando niveles de carbamazepina.",
        "clinical_significance": "Toxicidad por carbamazepina: ataxia, vision borrosa, nauseas.",
        "management": "Monitorear niveles de carbamazepina. Considerar otro SSRI (sertralina tiene menor interaccion).",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Litio",
        "drug_b_name": "Hidroclorotiazida",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Tiazidas reducen excrecion renal de litio, aumentando niveles sanguineos.",
        "clinical_significance": "Toxicidad por litio en 1-4 semanas de uso concomitante.",
        "management": "Monitorear niveles de litio frecuentemente. Reducir dosis de litio 50% al iniciar tiazida.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Diazepam",
        "drug_b_name": "Morfina",
        "severity": "critical",
        "interaction_type": "pharmacodynamic",
        "description": "Benzodiazepinas + opioides causan depresion respiratoria aditiva potencialmente fatal.",
        "clinical_significance": "Riesgo de depresion respiratoria severa, coma y muerte. FDA Black Box Warning.",
        "management": "Evitar uso concomitante si posible. Si es necesario, usar dosis minimas de ambos con monitoreo respiratorio.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Sertralina",
        "drug_b_name": "Sumatriptan",
        "severity": "moderate",
        "interaction_type": "pharmacodynamic",
        "description": "SSRI + triptanes aumenta riesgo de sindrome serotoninergico.",
        "clinical_significance": "Riesgo bajo pero real de sindrome serotoninergico.",
        "management": "Usar con precaucion. Monitorear sintomas serotoninergicos (agitacion, confusion, taquicardia).",
        "evidence_level": "probable",
    },
    # ============================================================
    # 7. Other common interactions (6)
    # ============================================================
    {
        "drug_a_name": "Sildenafil",
        "drug_b_name": "Nitroglicerina",
        "severity": "critical",
        "interaction_type": "pharmacodynamic",
        "description": "Inhibidores de PDE5 + nitratos causan hipotension severa potencialmente fatal.",
        "clinical_significance": "Hipotension profunda, sincope, infarto de miocardio, muerte.",
        "management": "CONTRAINDICADO ABSOLUTAMENTE. No administrar nitratos dentro de 24h de sildenafil (48h para tadalafil).",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Espironolactona",
        "drug_b_name": "Cloruro de Potasio",
        "severity": "major",
        "interaction_type": "pharmacodynamic",
        "description": "Diuretico ahorrador de potasio + suplementos de K+ causan hiperpotasemia.",
        "clinical_significance": "Hiperpotasemia severa con riesgo de arritmias cardiacas fatales.",
        "management": "EVITAR combinacion. Monitorear potasio serico si es imprescindible.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Teofilina",
        "drug_b_name": "Ciprofloxacina",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Ciprofloxacina inhibe CYP1A2, aumentando niveles de teofilina.",
        "clinical_significance": "Toxicidad por teofilina: nauseas, vomitos, taquicardia, convulsiones.",
        "management": "Reducir dosis de teofilina 30-50%. Monitorear niveles de teofilina. Considerar azitromicina.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Alopurinol",
        "drug_b_name": "Azatioprina",
        "severity": "critical",
        "interaction_type": "pharmacokinetic",
        "description": "Alopurinol inhibe xantina oxidasa, bloqueando metabolismo de azatioprina.",
        "clinical_significance": "Mielosupresion severa: pancitopenia, sepsis, muerte.",
        "management": "Reducir azatioprina al 25-33% de la dosis habitual. Monitorear hemograma semanalmente.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Carbamazepina",
        "drug_b_name": "Anticonceptivos Orales",
        "severity": "major",
        "interaction_type": "pharmacokinetic",
        "description": "Carbamazepina induce CYP3A4, reduciendo niveles de anticonceptivos.",
        "clinical_significance": "Falla anticonceptiva con riesgo de embarazo no deseado.",
        "management": "Usar metodo anticonceptivo adicional de barrera o considerar DIU.",
        "evidence_level": "established",
    },
    {
        "drug_a_name": "Omeprazol",
        "drug_b_name": "Clopidogrel",
        "severity": "moderate",
        "interaction_type": "pharmacokinetic",
        "description": "Omeprazol inhibe CYP2C19, reduciendo activacion de clopidogrel.",
        "clinical_significance": "Reduccion del efecto antiplaquetario. Mayor riesgo de eventos cardiovasculares.",
        "management": "Usar pantoprazol (menor interaccion con CYP2C19) en lugar de omeprazol.",
        "evidence_level": "established",
    },
]


async def seed_interactions():
    """Seed drug interactions into database. Idempotent."""
    from sqlalchemy import select
    from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

    from app.core.config import settings
    from app.core.database import Base
    from app.modules.cds.models import DrugInteraction

    engine = create_async_engine(settings.DATABASE_URL)
    SessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with SessionLocal() as session:
        # Check existing count
        result = await session.execute(
            select(DrugInteraction).limit(1)
        )
        if result.scalar_one_or_none():
            print(f"Drug interactions already seeded. Skipping.")
            return

        for data in INTERACTIONS:
            interaction = DrugInteraction(**data, source="local_kb")
            session.add(interaction)

        await session.commit()
        print(f"Seeded {len(INTERACTIONS)} drug-drug interactions.")


if __name__ == "__main__":
    import asyncio
    asyncio.run(seed_interactions())
