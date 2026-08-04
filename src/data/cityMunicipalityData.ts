/**
 * Centralized dummy list of Cities / Municipalities.
 * Replace this with a real API call once the backend endpoint is available;
 * the shape below is intentionally close to the location API shape.
 */
export interface CityMunicipalityModel {
  cityMunicipalityNo: string;
  cityMunicipalityCode: string;
  cityMunicipalityName: string;
  province: string;
}

export const cityMunicipalityData: CityMunicipalityModel[] = [
  // Occidental Mindoro
  {
    cityMunicipalityNo: "OCM-01",
    cityMunicipalityCode: "ABRA",
    cityMunicipalityName: "Abra De Ilog",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-02",
    cityMunicipalityCode: "CALI",
    cityMunicipalityName: "Calintaan",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-03",
    cityMunicipalityCode: "LOOC",
    cityMunicipalityName: "Looc",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-04",
    cityMunicipalityCode: "LUBA",
    cityMunicipalityName: "Lubang",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-05",
    cityMunicipalityCode: "MAGS",
    cityMunicipalityName: "Magsaysay",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-06",
    cityMunicipalityCode: "MAMB",
    cityMunicipalityName: "Mamburao",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-07",
    cityMunicipalityCode: "PALU",
    cityMunicipalityName: "Paluan",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-08",
    cityMunicipalityCode: "RIZA",
    cityMunicipalityName: "Rizal",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-09",
    cityMunicipalityCode: "SABL",
    cityMunicipalityName: "Sablayan",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-10",
    cityMunicipalityCode: "SANJ",
    cityMunicipalityName: "San Jose",
    province: "Occidental Mindoro",
  },
  {
    cityMunicipalityNo: "OCM-11",
    cityMunicipalityCode: "STCR",
    cityMunicipalityName: "Santa Cruz",
    province: "Occidental Mindoro",
  },

  // Oriental Mindoro
  {
    cityMunicipalityNo: "ORM-01",
    cityMunicipalityCode: "BACO",
    cityMunicipalityName: "Baco",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-02",
    cityMunicipalityCode: "BANS",
    cityMunicipalityName: "Bansud",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-03",
    cityMunicipalityCode: "BONG",
    cityMunicipalityName: "Bongabong",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-04",
    cityMunicipalityCode: "CALA",
    cityMunicipalityName: "Calapan City",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-05",
    cityMunicipalityCode: "GLOR",
    cityMunicipalityName: "Gloria",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-06",
    cityMunicipalityCode: "NAUJ",
    cityMunicipalityName: "Naujan",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-07",
    cityMunicipalityCode: "PINA",
    cityMunicipalityName: "Pinamalayan",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-08",
    cityMunicipalityCode: "PTGA",
    cityMunicipalityName: "Puerto Galera",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-09",
    cityMunicipalityCode: "ROXA",
    cityMunicipalityName: "Roxas",
    province: "Oriental Mindoro",
  },
  {
    cityMunicipalityNo: "ORM-10",
    cityMunicipalityCode: "SANT",
    cityMunicipalityName: "San Teodoro",
    province: "Oriental Mindoro",
  },

  // Marinduque
  {
    cityMunicipalityNo: "MRQ-01",
    cityMunicipalityCode: "BOAC",
    cityMunicipalityName: "Boac",
    province: "Marinduque",
  },
  {
    cityMunicipalityNo: "MRQ-02",
    cityMunicipalityCode: "BUEN",
    cityMunicipalityName: "Buenavista",
    province: "Marinduque",
  },
  {
    cityMunicipalityNo: "MRQ-03",
    cityMunicipalityCode: "GASA",
    cityMunicipalityName: "Gasan",
    province: "Marinduque",
  },
  {
    cityMunicipalityNo: "MRQ-04",
    cityMunicipalityCode: "MOGP",
    cityMunicipalityName: "Mogpog",
    province: "Marinduque",
  },
  {
    cityMunicipalityNo: "MRQ-05",
    cityMunicipalityCode: "STCM",
    cityMunicipalityName: "Santa Cruz (Mrq)",
    province: "Marinduque",
  },
  {
    cityMunicipalityNo: "MRQ-06",
    cityMunicipalityCode: "TORR",
    cityMunicipalityName: "Torrijos",
    province: "Marinduque",
  },

  // Romblon
  {
    cityMunicipalityNo: "ROM-01",
    cityMunicipalityCode: "ODIO",
    cityMunicipalityName: "Odiongan",
    province: "Romblon",
  },
  {
    cityMunicipalityNo: "ROM-02",
    cityMunicipalityCode: "ROMC",
    cityMunicipalityName: "Romblon",
    province: "Romblon",
  },
  {
    cityMunicipalityNo: "ROM-03",
    cityMunicipalityCode: "SANF",
    cityMunicipalityName: "San Fernando (Rom)",
    province: "Romblon",
  },

  // Palawan
  {
    cityMunicipalityNo: "PLW-01",
    cityMunicipalityCode: "PPCC",
    cityMunicipalityName: "Puerto Princesa City",
    province: "Palawan",
  },
  {
    cityMunicipalityNo: "PLW-02",
    cityMunicipalityCode: "CORN",
    cityMunicipalityName: "Coron",
    province: "Palawan",
  },
  {
    cityMunicipalityNo: "PLW-03",
    cityMunicipalityCode: "ELND",
    cityMunicipalityName: "El Nido",
    province: "Palawan",
  },
];
