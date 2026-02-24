const COLLEGES = [
    // IIITs
    { name: "IIIT Lucknow", domain: "iiitl.ac.in" },
    { name: "IIIT Hyderabad", domain: "iiit.ac.in" },
    { name: "IIIT Hyderabad (Students)", domain: "students.iiit.ac.in" },
    { name: "IIIT Bangalore", domain: "iiitb.ac.in" },
    { name: "IIIT Delhi", domain: "iiitd.ac.in" },
    { name: "IIIT Allahabad", domain: "iiita.ac.in" },
    { name: "IIIT Sri City", domain: "iiits.in" },
    { name: "IIIT Kottayam", domain: "iiitkottayam.ac.in" },
    { name: "IIIT Guwahati", domain: "iiitg.ac.in" },
    { name: "IIIT Kalyani", domain: "iiitkalyani.ac.in" },
    { name: "IIIT Una", domain: "iiitu.ac.in" },
    { name: "IIIT Sonepat", domain: "iiitsonepat.ac.in" },
    { name: "IIIT Nagpur", domain: "iiitn.ac.in" },
    { name: "IIIT Pune", domain: "iiitp.ac.in" },
    { name: "IIIT Ranchi", domain: "iiitranchi.ac.in" },
    { name: "IIIT Vadodara", domain: "iiitvadodara.ac.in" },

    // IITs
    { name: "IIT Bombay", domain: "iitb.ac.in" },
    { name: "IIT Delhi", domain: "iitd.ac.in" },
    { name: "IIT Madras", domain: "iitm.ac.in" },
    { name: "IIT Kanpur", domain: "iitk.ac.in" },
    { name: "IIT Kharagpur", domain: "iitkgp.ac.in" },
    { name: "IIT Roorkee", domain: "iitr.ac.in" },
    { name: "IIT Guwahati", domain: "iitg.ac.in" },
    { name: "IIT BHU Varanasi", domain: "iitbhu.ac.in" },
    { name: "IIT Hyderabad", domain: "iith.ac.in" },
    { name: "IIT Indore", domain: "iiti.ac.in" },
    { name: "IIT Mandi", domain: "iitmandi.ac.in" },
    { name: "IIT Patna", domain: "iitp.ac.in" },
    { name: "IIT Bhubaneswar", domain: "iitbbs.ac.in" },
    { name: "IIT Jodhpur", domain: "iitj.ac.in" },
    { name: "IIT Gandhinagar", domain: "iitgn.ac.in" },
    { name: "IIT Ropar", domain: "iitrpr.ac.in" },
    { name: "IIT Tirupati", domain: "iittp.ac.in" },
    { name: "IIT Dhanbad (ISM)", domain: "iitism.ac.in" },
    { name: "IIT Palakkad", domain: "iitpkd.ac.in" },
    { name: "IIT Jammu", domain: "iitjammu.ac.in" },
    { name: "IIT Dharwad", domain: "iitdh.ac.in" },
    { name: "IIT Bhilai", domain: "iitbhilai.ac.in" },
    { name: "IIT Goa", domain: "iitgoa.ac.in" },

    // NITs
    { name: "NIT Trichy", domain: "nitt.edu" },
    { name: "NIT Warangal", domain: "nitw.ac.in" },
    { name: "NIT Surathkal", domain: "nitk.edu.in" },
    { name: "NIT Calicut", domain: "nitc.ac.in" },
    { name: "NIT Rourkela", domain: "nitrkl.ac.in" },
    { name: "NIT Allahabad (MNNIT)", domain: "mnnit.ac.in" },
    { name: "NIT Jaipur (MNIT)", domain: "mnit.ac.in" },
    { name: "NIT Kurukshetra", domain: "nitkkr.ac.in" },
    { name: "NIT Durgapur", domain: "nitdgp.ac.in" },
    { name: "NIT Silchar", domain: "nits.ac.in" },
    { name: "NIT Srinagar", domain: "nitsri.ac.in" },
    { name: "NIT Hamirpur", domain: "nith.ac.in" },
    { name: "NIT Nagpur (VNIT)", domain: "vnit.ac.in" },
    { name: "NIT Surat (SVNIT)", domain: "svnit.ac.in" },
    { name: "NIT Patna", domain: "nitp.ac.in" },
    { name: "NIT Raipur", domain: "nitrr.ac.in" },
    { name: "NIT Agartala", domain: "nita.ac.in" },
    { name: "NIT Meghalaya", domain: "nitm.ac.in" },
    { name: "NIT Manipur", domain: "nitmanipur.ac.in" },
    { name: "NIT Mizoram", domain: "nitmz.ac.in" },
    { name: "NIT Arunachal Pradesh", domain: "nitap.ac.in" },
    { name: "NIT Sikkim", domain: "nitskm.ac.in" },
    { name: "NIT Goa", domain: "nitgoa.ac.in" },
    { name: "NIT Delhi", domain: "nitdelhi.ac.in" },
    { name: "NIT Uttarakhand", domain: "nituk.ac.in" },
    { name: "NIT Andhra Pradesh", domain: "nitandhra.ac.in" },
    { name: "NIT Jamshedpur", domain: "nitjsr.ac.in" },
    { name: "NIT Jalandhar", domain: "nitj.ac.in" },

    // BITS Pilani campuses
    { name: "BITS Pilani", domain: "pilani.bits-pilani.ac.in" },
    { name: "BITS Pilani - Hyderabad", domain: "hyderabad.bits-pilani.ac.in" },
    { name: "BITS Pilani - Goa", domain: "goa.bits-pilani.ac.in" },

    // Other top institutions
    { name: "VIT Vellore", domain: "vit.ac.in" },
    { name: "SRM University", domain: "srmist.edu.in" },
    { name: "Manipal Institute of Technology", domain: "learner.manipal.edu" },
    { name: "DTU Delhi", domain: "dtu.ac.in" },
    { name: "NSUT Delhi", domain: "nsut.ac.in" },
    { name: "Jadavpur University", domain: "jadavpuruniversity.in" },
    { name: "Anna University", domain: "annauniv.edu" },
    { name: "IISc Bangalore", domain: "iisc.ac.in" },
    { name: "ISI Kolkata", domain: "isical.ac.in" },
    { name: "IIIT Kancheepuram", domain: "iiitdm.ac.in" },
    { name: "Thapar University", domain: "thapar.edu" },
    { name: "PEC Chandigarh", domain: "pec.ac.in" },
    { name: "COEP Pune", domain: "coeptech.ac.in" },
    { name: "PSG Tech Coimbatore", domain: "psgtech.ac.in" },
    { name: "Amrita University", domain: "amrita.edu" },
    { name: "LNMIIT Jaipur", domain: "lnmiit.ac.in" },
    { name: "DAIICT Gandhinagar", domain: "daiict.ac.in" },
    { name: "RVCE Bangalore", domain: "rvce.edu.in" },
    { name: "BMS College of Engineering", domain: "bmsce.ac.in" },
    { name: "PES University", domain: "pes.edu" },
    { name: "Christ University", domain: "christuniversity.in" },
    { name: "Presidency University", domain: "presidencyuniversity.in" },

    // Demo / Testing
    { name: "CampusConnect Demo College", domain: "gmail.com", isDemo: true },
];

const VALID_EDUCATIONAL_SUFFIXES = [".edu", ".ac.in", ".edu.in"];

const getCollegeByDomain = (domain) => {
    if (!domain) return null;
    const normalized = domain.toLowerCase().trim();
    return COLLEGES.find((c) => c.domain === normalized) || null;
};

const getCollegeByEmail = (email) => {
    if (!email) return null;
    const domain = email.toLowerCase().trim().split("@")[1];
    if (!domain) return null;

    const known = getCollegeByDomain(domain);
    if (known) return known;

    if (VALID_EDUCATIONAL_SUFFIXES.some((suffix) => domain.endsWith(suffix))) {
        return { name: domain, domain };
    }

    return null;
};

const isValidCollegeEmail = (email) => {
    if (!email) return false;
    const domain = email.toLowerCase().trim().split("@")[1];
    if (!domain) return false;

    if (getCollegeByDomain(domain)) return true;

    return VALID_EDUCATIONAL_SUFFIXES.some((suffix) => domain.endsWith(suffix));
};

const isDemoEmail = (email) => {
    if (!email) return false;
    const domain = email.toLowerCase().trim().split("@")[1];
    const college = getCollegeByDomain(domain);
    return college?.isDemo === true;
};

const getAllColleges = () => [...COLLEGES];

export {
    COLLEGES,
    getCollegeByDomain,
    getCollegeByEmail,
    isValidCollegeEmail,
    isDemoEmail,
    getAllColleges,
};
