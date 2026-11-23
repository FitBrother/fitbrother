/**
 * Proporção da foto no feed: 4:5, em pé.
 *
 * É o mais alto que o Instagram aceita num feed, e foto de comida quase sempre
 * sai em pé do celular — deitada, metade do enquadramento é mesa. O preço é o
 * card passar de 680px num iPhone de 844, ou seja, um post por tela.
 *
 * Mora aqui, e não no componente, porque o card e o recorte gravado ao publicar
 * PRECISAM concordar: se divergirem, a foto é cortada de um jeito na hora de
 * escolher e exibida de outro no feed, e ninguém percebe até ver o resultado
 * publicado.
 */
export const FEED_PHOTO_ASPECT = 4 / 5;
