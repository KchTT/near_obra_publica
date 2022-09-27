export const estados = ["PRESENTADO", "EVALUACION", "GANADOR", "DESCARTADO"]

export class Licitacion {
  sender: string;
  unix_timestamp: number;
  empresa: string;
  cuit: number;
  descripcion: string;
  monto: number;
  tiempo: number; //dias
  fecha_evaluacion: number;
  valoracion: number;
  justificacion: string;
  hash_presupuesto: string;
  estado: number

  constructor({ sender, unix_timestamp, empresa, cuit, descripcion, monto, tiempo, hash_presupuesto, estado }: {
    sender: string;
    unix_timestamp: number;
    empresa: string;
    cuit: number;
    descripcion: string;
    monto: number;
    tiempo: number; //dias
    hash_presupuesto: string;
    estado: number
  }) {
    this.sender = sender;
    this.unix_timestamp = unix_timestamp;
    this.empresa = empresa;
    this.cuit = cuit;
    this.descripcion = descripcion;
    this.monto = monto;
    this.tiempo = tiempo;
    this.hash_presupuesto = hash_presupuesto;
    this.estado = estado;
  }
  cambia_estado(estado) {
    this.estado = estado
  }

  evalua(valoracion, justificacion, estado) {
    const unix_timestamp = Math.floor(Date.now() / 1000)
    this.fecha_evaluacion = unix_timestamp
    this.valoracion = valoracion
    this.justificacion = justificacion
    this.estado = estado
  }
}