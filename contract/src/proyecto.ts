export const estados = ["STAND BY", "ACTIVA", "FINALIZADA", "CANCELADA"]
import { Licitacion } from './licitacion'

export class Proyecto {
  sender: string;
  unix_timestamp: number;
  nombre: string;
  ubicacion: string;
  descripcion: string;
  apertura_licitacion: number;
  fecha_limite_licitacion: number;
  hash_pliego: string;
  licitaciones: Licitacion[];
  estado: number

  constructor({ sender, unix_timestamp, nombre, ubicacion, descripcion, apertura_licitacion, fecha_limite_licitacion, hash_pliego, estado }: {
    sender: string;
    unix_timestamp: number;
    nombre: string;
    ubicacion: string;
    descripcion: string;
    apertura_licitacion: number;
    fecha_limite_licitacion: number;
    hash_pliego: string;
    estado: number
  }) {
    this.sender = sender;
    this.unix_timestamp = unix_timestamp;
    this.nombre = nombre;
    this.ubicacion = ubicacion;
    this.descripcion = descripcion;
    this.apertura_licitacion = apertura_licitacion;
    this.fecha_limite_licitacion = fecha_limite_licitacion;
    this.hash_pliego = hash_pliego;
    this.estado = estado;
  }

  getter(){
    return {
      sender:this.sender,
      fecha:this.unix_timestamp,
      nombre:this.nombre,
      ubicacion: this.ubicacion,
      descripcion:this.descripcion,
      apertura_licitacion:this.apertura_licitacion,
      fecha_limite_licitacion:this.fecha_limite_licitacion,
      hash_pliego:this.hash_pliego,
      estado:estados[this.estado]
    }
  }

  cambia_estado(estado) {
    this.estado = estado
  }

  checkBetween(from, to) {
    return (this.unix_timestamp >= from && this.unix_timestamp <= to) ? true : false
  }

  checkActiva() {
    return this.estado == 1 ? true : false; 
  }

  agrega_licitacion(sender, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado) {
    const unix_timestamp = Math.floor(Date.now() / 1000)
    const licitacion = new Licitacion({ sender, unix_timestamp, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado });
    this.licitaciones.push(licitacion);
  }

  cambia_estado_licitacion(index_licitacion, estado) {
    this.licitaciones[index_licitacion].cambia_estado(estado)
  }

  evalua_licitacion(index_licitacion, valoracion, justificacion, estado) {
    this.licitaciones[index_licitacion].evalua(valoracion, justificacion, estado)
  }
}