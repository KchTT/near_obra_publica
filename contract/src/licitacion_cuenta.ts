export class LicitacionCuenta {
  unix_timestamp: number
  index_obra: number
  index_licitacion: number

  constructor({ unix_timestamp, index_obra, index_licitacion }: {
    unix_timestamp: number;
    index_obra: number;
    index_licitacion: number;
  }) {
    this.unix_timestamp = unix_timestamp;
    this.index_obra = index_obra;
    this.index_licitacion = index_licitacion;
  }
}