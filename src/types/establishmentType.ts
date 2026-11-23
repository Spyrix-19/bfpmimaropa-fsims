
export interface SearchBusinessEstablishmentParams {
    searchkey?: string;
    pagenumber: number;
    pagesize: number;
  }

  export interface BusinessEstablishmentDTO {
    establishmentno: string;
    establishmentcode: string;
    establishmentname: string;
    lastname: string;
    firstname: string;
    miname: string;
    suffix: string;
    fullname: string;
    contactno: string;
    emailaddress: string;
    regionno: string;
    provinceno: string;
    cityno: string;
    barangayno: string;
    streetaddress: string;
    landmark: string;
    stationno: string;
    latitude: number;
    longitude: number;
    statusno: number;
    buildingname: string;
    floorcount: number;
    buildingarea: number;
    fsecdateissued: string;
    fsecexpirationdate: string;
    fsicdateissued: string;
    fsicexpirationdate: string;
    remarks: string;
    isrequired: boolean;
    encodedby: string;
  }

export interface BusinessEstablishmentDetailParams {
    establishmentno: string;
}

export interface BusinessEstablishmentDetailModel {
    establishmentno: string;
    establishmentcode: string;
    establishmentname: string;
    lastname: string;
    firstname: string;
    miname: string;
    suffix: string;
    fullname: string;
    contactno: string;
    emailaddress: string;
  
    regionno: string;
    regionname: string;
    provinceno: string;
    provincename: string;
    cityno: string;
    cityname: string;
    zipcode: string;
    barangayno: string;
    barangayname: string;
  
    streetaddress: string;
    landmark: string;
  
    stationno: string;
    stationcode: string;
    stationname: string;
    stationlogourl: string;
  
    latitude: number;
    longitude: number;
  
    statusno: number;
    statuscode: string;
    statusname: string;
  
    buildingname: string;
    floorcount: number;
    buildingarea: number;
  
    fsecdateissued: string;
    fsecexpirationdate: string;
    fsicdateissued: string;
    fsicexpirationdate: string;
  
    remarks: string;
    isrequired: boolean;
  
    isdeleted: boolean;
    deletedby: string;
    datedeleted: string;
  
    updatedby: string;
    dateupdated: string;
  
    encodedby: string;
    dateencoded: string;
  }

  export interface BusinessEstablishmentLedgerParams {
    searchkey?: string;
    stationno?: string;
    provinceno?: string;
    statusno?: string;
    pagenumber: number;
    pagesize: number;
  }
  
  export interface BusinessEstablishmentModel {
    establishmentno: string;
    establishmentcode: string;
    establishmentname: string;
    lastname: string;
    firstname: string;
    miname: string;
    suffix: string;
    fullname: string;
    contactno: string;
    emailaddress: string;
  
    regionno: string;
    regionname: string;
    provinceno: string;
    provincename: string;
    cityno: string;
    cityname: string;
    zipcode: string;
    barangayno: string;
    barangayname: string;
  
    streetaddress: string;
    landmark: string;
  
    stationno: string;
    stationcode: string;
    stationname: string;
    stationlogourl: string;
  
    latitude: number;
    longitude: number;
  
    statusno: number;
    statuscode: string;
    statusname: string;
  
    buildingname: string;
    floorcount: number;
    buildingarea: number;
  
    fsecdateissued: string;
    fsecexpirationdate: string;
    fsicdateissued: string;
    fsicexpirationdate: string;
  
    remarks: string;
    isrequired: boolean;
  }

  export interface BusinessEstablishmentDeleteParams {
    establishmentno: string;
    deletedby: string;
    roleno: number;
  }