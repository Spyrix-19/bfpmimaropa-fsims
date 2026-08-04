export interface NotificationDTO {
  notificationno: string;
  systemno: string;
  recipientmemberno: string;
  sendermemberno: string;
  stationno: string;
  moduletype: string;
  notificationtype: string;
  referenceno: string;
  title: string;
  message: string;
  actionurl: string;
  icon: string;
  color: string;
  priority: string;
  updatedby: string;
  encodedby: string;
}

export interface NotificationReadDTO {
  readby: string;
  notificationList: NotificationReadClass[];
}

export interface NotificationReadClass {
  notificationno: string;
}

export interface NotificationDetailParams {
  notificationno: string;
}

export interface NotificationDetailModel {
  notificationno: string;
  systemno: string;
  systemcode: string;
  systemname: string;
  recipientmemberno: string;
  recipientmembername: string;
  sendermemberno: string;
  sendermembername: string;
  stationno: string;
  stationcode: string;
  stationname: string;
  logourl: string;
  moduletype: string;
  notificationtype: string;
  referenceno: string;
  title: string;
  message: string;
  actionurl: string;
  icon: string;
  color: string;
  priority: string;
  isread: boolean;
  readbyname: string;
  dateread: Date;
  isdeleted: boolean;
  deletedby: string;
  datedeleted: Date;
  deletedbyname: string;
  updatedby: string;
  dateupdated: Date;
  updatedbyname: string;
  encodedby: string;
  encodedbyname: string;
  dateencoded: Date;
}

export interface NotificationLedgerParams {
  searchkey: string;
  systemno: string;
  stationno: string;
  pagenumber: number;
  pagesize: number;
}

export interface NotificationModel {
  notificationno: string;
  moduletype: string;
  notificationtype: string;
  referenceno: string;
  title: string;
  message: string;
  actionurl: string;
  icon: string;
  color: string;
  priority: string;
  isread: boolean;
  readbyname: string;
  dateread: Date;
  dateencoded: Date;
}

export interface NotificationDeleteParams {
  notificationno: string;
  deletedby: string;
  roleno: number;
}
